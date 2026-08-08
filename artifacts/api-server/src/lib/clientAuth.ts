import { Request, Response, NextFunction } from "express";
import { db, brokerClientsTable, brokerClientSessionsTable, BrokerClient } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Auth for TRADING CLIENTS (broker_clients) — deliberately separate from the
// affiliate auth in ./auth.ts. Passwords use bcrypt from day one; do not reuse
// the static-salt SHA-256 hashPassword from ./auth.ts here.

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = 7;

export function hashClientPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyClientPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateClientToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function storeClientToken(token: string, clientId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(brokerClientSessionsTable).values({ token, clientId, expiresAt });
}

export async function removeClientToken(token: string): Promise<void> {
  await db.delete(brokerClientSessionsTable).where(eq(brokerClientSessionsTable.token, token));
}

export function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// Codes and set-password tokens are stored hashed so a DB read alone cannot
// take over an account.
export function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function clientToProfile(client: BrokerClient) {
  return {
    id: client.id,
    email: client.email,
    fullName: client.fullName,
    phone: client.phone,
    country: client.country,
    status: client.status,
    kycStatus: client.kycStatus,
    createdAt: client.createdAt,
  };
}

export async function requireClient(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  const now = new Date();
  const sessions = await db
    .select({ clientId: brokerClientSessionsTable.clientId })
    .from(brokerClientSessionsTable)
    .where(
      and(eq(brokerClientSessionsTable.token, token), gt(brokerClientSessionsTable.expiresAt, now))
    )
    .limit(1);
  if (!sessions[0]) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }
  const clients = await db
    .select()
    .from(brokerClientsTable)
    .where(eq(brokerClientsTable.id, sessions[0].clientId))
    .limit(1);
  if (!clients[0] || clients[0].status !== "active") {
    res.status(401).json({ error: "Unauthorized", message: "Client not found or inactive" });
    return;
  }
  (req as any).client = clients[0];
  next();
}

export function getReqClient(req: Request): BrokerClient {
  return (req as any).client as BrokerClient;
}
