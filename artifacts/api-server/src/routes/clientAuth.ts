import { Router, type IRouter } from "express";
import { db, brokerClientsTable, brokerEmailCodesTable, brokerWalletsTable } from "@workspace/db";
import { eq, and, desc, isNull, gt } from "drizzle-orm";
import crypto from "crypto";
import {
  clientToProfile,
  generateClientToken,
  generateVerificationCode,
  hashClientPassword,
  hashVerificationCode,
  removeClientToken,
  requireClient,
  getReqClient,
  storeClientToken,
  verifyClientPassword,
} from "../lib/clientAuth";
import { sendClientVerificationCode, EmailSendError } from "../lib/emailBroker";

const router: IRouter = Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_THROTTLE_MS = 60 * 1000;
const SET_PASSWORD_TTL_MS = 30 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

// Issues a fresh code for the email (throttled) and emails it. In production a
// failed send is a hard error; in development the code is logged so the flow
// stays testable without a verified Resend domain.
async function issueAndSendCode(
  email: string,
  clientId: number,
  log: { warn: (obj: object, msg: string) => void }
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const latest = await db
    .select({ createdAt: brokerEmailCodesTable.createdAt })
    .from(brokerEmailCodesTable)
    .where(eq(brokerEmailCodesTable.email, email))
    .orderBy(desc(brokerEmailCodesTable.createdAt))
    .limit(1);
  if (latest[0] && Date.now() - latest[0].createdAt.getTime() < RESEND_THROTTLE_MS) {
    return { ok: false, status: 429, message: "Please wait a minute before requesting another code" };
  }

  const code = generateVerificationCode();
  await db.insert(brokerEmailCodesTable).values({
    email,
    clientId,
    codeHash: hashVerificationCode(code),
    purpose: "verify_email",
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendClientVerificationCode(email, code);
  } catch (err) {
    if (err instanceof EmailSendError && process.env.NODE_ENV !== "production") {
      log.warn({ email, code }, "DEV ONLY: email send failed, verification code logged");
      return { ok: true };
    }
    return { ok: false, status: 502, message: "Could not send the verification email. Please try again." };
  }
  return { ok: true };
}

router.post("/auth/register", async (req, res) => {
  try {
    const { email, fullName, phone, country } = req.body;
    if (!email || !fullName) {
      res.status(400).json({ error: "Bad Request", message: "Email and full name required" });
      return;
    }
    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await db
      .select()
      .from(brokerClientsTable)
      .where(eq(brokerClientsTable.email, normalizedEmail))
      .limit(1);

    let clientId: number;
    if (existing[0]) {
      if (existing[0].status !== "pending_email") {
        res.status(409).json({ error: "Conflict", message: "This email is already registered. Please log in." });
        return;
      }
      // Unverified re-registration: refresh details, re-send a code.
      await db
        .update(brokerClientsTable)
        .set({ fullName, phone: phone ?? null, country: country ?? null })
        .where(eq(brokerClientsTable.id, existing[0].id));
      clientId = existing[0].id;
    } else {
      const inserted = await db
        .insert(brokerClientsTable)
        .values({ email: normalizedEmail, fullName, phone: phone ?? null, country: country ?? null })
        .returning({ id: brokerClientsTable.id });
      clientId = inserted[0].id;
    }

    const sent = await issueAndSendCode(normalizedEmail, clientId, req.log);
    if (!sent.ok) {
      res.status(sent.status).json({ error: "Send Failed", message: sent.message });
      return;
    }
    res.status(201).json({ success: true, message: "Verification code sent. Check your email." });
  } catch (err) {
    req.log.error({ err }, "Client register error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/auth/resend-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Bad Request", message: "Email required" });
      return;
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const clients = await db
      .select()
      .from(brokerClientsTable)
      .where(eq(brokerClientsTable.email, normalizedEmail))
      .limit(1);
    if (!clients[0] || clients[0].status !== "pending_email") {
      // Same response as success to prevent email enumeration.
      res.json({ success: true, message: "If that email is pending verification, a code has been sent." });
      return;
    }
    const sent = await issueAndSendCode(normalizedEmail, clients[0].id, req.log);
    if (!sent.ok) {
      res.status(sent.status).json({ error: "Send Failed", message: sent.message });
      return;
    }
    res.json({ success: true, message: "Verification code sent. Check your email." });
  } catch (err) {
    req.log.error({ err }, "Client resend code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/auth/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Bad Request", message: "Email and code required" });
      return;
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const now = new Date();
    const rows = await db
      .select()
      .from(brokerEmailCodesTable)
      .where(
        and(
          eq(brokerEmailCodesTable.email, normalizedEmail),
          isNull(brokerEmailCodesTable.consumedAt),
          gt(brokerEmailCodesTable.expiresAt, now)
        )
      )
      .orderBy(desc(brokerEmailCodesTable.createdAt))
      .limit(1);
    const record = rows[0];
    if (!record || record.attempts >= MAX_CODE_ATTEMPTS) {
      res.status(400).json({ error: "Bad Request", message: "Invalid or expired code. Request a new one." });
      return;
    }
    if (record.codeHash !== hashVerificationCode(String(code).trim())) {
      await db
        .update(brokerEmailCodesTable)
        .set({ attempts: record.attempts + 1 })
        .where(eq(brokerEmailCodesTable.id, record.id));
      res.status(400).json({ error: "Bad Request", message: "Incorrect code. Please try again." });
      return;
    }

    const setPasswordToken = crypto.randomBytes(32).toString("hex");
    await db
      .update(brokerEmailCodesTable)
      .set({ consumedAt: now, setPasswordToken })
      .where(eq(brokerEmailCodesTable.id, record.id));
    if (record.clientId) {
      await db
        .update(brokerClientsTable)
        .set({ emailVerifiedAt: now })
        .where(eq(brokerClientsTable.id, record.clientId));
      // The wallet exists from the moment the email is real.
      await db
        .insert(brokerWalletsTable)
        .values({ clientId: record.clientId })
        .onConflictDoNothing({ target: brokerWalletsTable.clientId });
    }
    res.json({ setPasswordToken });
  } catch (err) {
    req.log.error({ err }, "Client verify email error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/auth/set-password", async (req, res) => {
  try {
    const { setPasswordToken, password } = req.body;
    if (!setPasswordToken || !password) {
      res.status(400).json({ error: "Bad Request", message: "Token and password required" });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: "Bad Request", message: "Password must be at least 8 characters" });
      return;
    }
    const rows = await db
      .select()
      .from(brokerEmailCodesTable)
      .where(eq(brokerEmailCodesTable.setPasswordToken, String(setPasswordToken)))
      .limit(1);
    const record = rows[0];
    const consumedAtMs = record?.consumedAt?.getTime() ?? 0;
    if (!record || !record.clientId || Date.now() - consumedAtMs > SET_PASSWORD_TTL_MS) {
      res.status(400).json({ error: "Bad Request", message: "Invalid or expired link. Please verify again." });
      return;
    }

    const passwordHash = await hashClientPassword(String(password));
    await db
      .update(brokerClientsTable)
      .set({ passwordHash, status: "active", lastLoginAt: new Date() })
      .where(eq(brokerClientsTable.id, record.clientId));
    // One-time: clear the token so it cannot be replayed.
    await db
      .update(brokerEmailCodesTable)
      .set({ setPasswordToken: null })
      .where(eq(brokerEmailCodesTable.id, record.id));

    const clients = await db
      .select()
      .from(brokerClientsTable)
      .where(eq(brokerClientsTable.id, record.clientId))
      .limit(1);
    const token = generateClientToken();
    await storeClientToken(token, record.clientId);
    res.json({ client: clientToProfile(clients[0]), token });
  } catch (err) {
    req.log.error({ err }, "Client set password error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Email and password required" });
      return;
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const clients = await db
      .select()
      .from(brokerClientsTable)
      .where(eq(brokerClientsTable.email, normalizedEmail))
      .limit(1);
    const client = clients[0];
    if (!client || !client.passwordHash || !(await verifyClientPassword(String(password), client.passwordHash))) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }
    if (client.status !== "active") {
      res.status(401).json({
        error: "Unauthorized",
        message:
          client.status === "pending_email"
            ? "Please verify your email first"
            : "Account is suspended. Contact support.",
      });
      return;
    }
    await db
      .update(brokerClientsTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(brokerClientsTable.id, client.id));
    const token = generateClientToken();
    await storeClientToken(token, client.id);
    res.json({ client: clientToProfile(client), token });
  } catch (err) {
    req.log.error({ err }, "Client login error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    await removeClientToken(authHeader.slice(7));
  }
  res.json({ success: true });
});

router.get("/me", requireClient, async (req, res) => {
  res.json(clientToProfile(getReqClient(req)));
});

export default router;
