import { Request, Response, NextFunction } from "express";
import { db, usersTable, userSessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "1of1traderpro_salt").digest("hex");
}

export function generateToken(userId: number): string {
  return crypto.randomBytes(32).toString("hex") + "." + Buffer.from(String(userId)).toString("base64");
}

export function generateAffiliateCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = crypto.randomBytes(3).toString("hex");
  return slug + rand;
}

export async function storeToken(token: string, userId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.insert(userSessionsTable).values({ token, userId, expiresAt });
}

export async function getTokenUserId(token: string): Promise<number | null> {
  const now = new Date();
  const rows = await db
    .select({ userId: userSessionsTable.userId })
    .from(userSessionsTable)
    .where(and(eq(userSessionsTable.token, token), gt(userSessionsTable.expiresAt, now)))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function removeToken(token: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.token, token));
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  const userId = await getTokenUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user[0] || user[0].status !== "active") {
    res.status(401).json({ error: "Unauthorized", message: "User not found or inactive" });
    return;
  }
  (req as any).user = user[0];
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }
    next();
  });
}

export async function requireAffiliate(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user?.role !== "affiliate" && user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Affiliate access required" });
      return;
    }
    next();
  });
}
