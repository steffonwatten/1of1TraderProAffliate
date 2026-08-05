import { Router, type IRouter } from "express";
import { db, usersTable, affiliatesTable, passwordResetTokensTable, userSessionsTable } from "@workspace/db";
import { eq, and, gt, isNull, ne, lt } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword, generateToken, storeToken, removeToken, requireAuth } from "../lib/auth";
import { sendPasswordReset } from "../lib/email";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Email and password required" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    const user = users[0];
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }
    if (user.status !== "active") {
      res.status(401).json({ error: "Unauthorized", message: "Account is inactive" });
      return;
    }
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const token = generateToken(user.id);
    await storeToken(token, user.id);

    let affiliateId: number | null = null;
    let affiliateCode: string | null = null;
    if (user.role === "affiliate") {
      const aff = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
      if (aff[0]) {
        affiliateId = aff[0].id;
        affiliateCode = aff[0].affiliateCode;
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        affiliateId,
        affiliateCode,
      },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    await removeToken(authHeader.slice(7));
  }
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    let affiliateId: number | null = null;
    let affiliateCode: string | null = null;
    if (user.role === "affiliate") {
      const aff = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
      if (aff[0]) {
        affiliateId = aff[0].id;
        affiliateCode = aff[0].affiliateCode;
      }
    }
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      affiliateId,
      affiliateCode,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Bad Request", message: "Email required" });
      return;
    }
    // Always respond with success to prevent email enumeration
    res.json({ success: true, message: "If an account with that email exists, a reset link has been sent." });

    // Look up user (after response to prevent timing attacks)
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!users[0]) return;
    const user = users[0];

    // Generate a secure reset token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

    const baseUrl = process.env.BASE_URL ?? "https://affiliates1of1trader.pro";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    sendPasswordReset(user.email, user.fullName ?? "there", resetUrl)
      .catch((err) => console.error("Failed to send reset email:", err));
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    // Already responded, swallow the error
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Bad Request", message: "Current password and new password required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Bad Request", message: "New password must be at least 8 characters" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (!users[0] || users[0].passwordHash !== hashPassword(currentPassword)) {
      res.status(400).json({ error: "Bad Request", message: "Current password is incorrect" });
      return;
    }
    await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const now = new Date();
    const sessions = await db.select({ id: userSessionsTable.id, createdAt: userSessionsTable.createdAt, expiresAt: userSessionsTable.expiresAt })
      .from(userSessionsTable)
      .where(and(eq(userSessionsTable.userId, user.id), gt(userSessionsTable.expiresAt, now)));
    const currentToken = req.headers.authorization?.slice(7) ?? "";
    const currentSessions = await db.select({ id: userSessionsTable.id }).from(userSessionsTable)
      .where(and(eq(userSessionsTable.userId, user.id), eq(userSessionsTable.token, currentToken))).limit(1);
    const currentSessionId = currentSessions[0]?.id;
    res.json({
      sessions: sessions.map(s => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, isCurrent: s.id === currentSessionId }))
    });
  } catch (err) {
    req.log.error({ err }, "Get sessions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sessionId = parseInt(req.params.id as string);
    const currentToken = req.headers.authorization?.slice(7) ?? "";
    const currentSessions = await db.select({ id: userSessionsTable.id }).from(userSessionsTable)
      .where(and(eq(userSessionsTable.userId, user.id), eq(userSessionsTable.token, currentToken))).limit(1);
    if (currentSessions[0]?.id === sessionId) {
      res.status(400).json({ error: "Bad Request", message: "Cannot revoke your current session" });
      return;
    }
    await db.delete(userSessionsTable).where(and(eq(userSessionsTable.id, sessionId), eq(userSessionsTable.userId, user.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete session error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/sessions", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const currentToken = req.headers.authorization?.slice(7) ?? "";
    await db.delete(userSessionsTable).where(and(eq(userSessionsTable.userId, user.id), ne(userSessionsTable.token, currentToken)));
    res.json({ success: true, message: "All other sessions revoked" });
  } catch (err) {
    req.log.error({ err }, "Revoke all sessions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: "Bad Request", message: "Token and password required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Bad Request", message: "Password must be at least 8 characters" });
      return;
    }

    const now = new Date();
    const rows = await db.select().from(passwordResetTokensTable).where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt)
      )
    ).limit(1);

    if (!rows[0]) {
      res.status(400).json({ error: "Bad Request", message: "Invalid or expired reset link. Please request a new one." });
      return;
    }

    const resetRecord = rows[0];

    // Update password and mark token as used
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(usersTable.id, resetRecord.userId));
    await db.update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));

    res.json({ success: true, message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
