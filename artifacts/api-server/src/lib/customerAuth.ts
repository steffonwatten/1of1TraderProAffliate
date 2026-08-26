import { Request, Response, NextFunction } from "express";
import {
  db,
  customerAccountsTable,
  customerSessionsTable,
  customerEmailCodesTable,
  CustomerAccount,
} from "@workspace/db";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Auth for INDICATOR CUSTOMERS (customer_accounts) — the third population in
// this codebase, alongside affiliate/admin `users` and broker `broker_clients`.
//
// bcrypt from day one. Never reach for `hashPassword` in ./auth.ts: that is the
// affiliate side's static-salt SHA-256, kept only because changing it would lock
// out every existing affiliate. New surfaces do not inherit that debt.
//
// Never mix this middleware with requireAffiliate/requireAdmin/requireClient.
// A customer token must not resolve in any other population and vice versa —
// which is why the sessions live in their own table rather than a shared one
// with a discriminator column.

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;

export function hashCustomerPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyCustomerPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateCustomerToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function storeCustomerToken(token: string, customerAccountId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(customerSessionsTable).values({ token, customerAccountId, expiresAt });
}

export async function removeCustomerToken(token: string): Promise<void> {
  await db.delete(customerSessionsTable).where(eq(customerSessionsTable.token, token));
}

/** Six digits. Stored hashed — see issueEmailCode. */
export function generateEmailCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Issues a fresh code and invalidates any earlier unused ones for the same
 * purpose. Without that expiry sweep, every code ever mailed to an address
 * would stay valid until its own TTL, so requesting a new code would widen the
 * guessable set instead of replacing it.
 *
 * Returns the PLAINTEXT code to email. Only the hash reaches the database, so a
 * read of customer_email_codes cannot be replayed into an account takeover.
 */
export async function issueEmailCode(
  customerAccountId: number,
  purpose: "verify_email" | "password_reset"
): Promise<string> {
  const now = new Date();
  await db
    .update(customerEmailCodesTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(customerEmailCodesTable.customerAccountId, customerAccountId),
        eq(customerEmailCodesTable.purpose, purpose),
        isNull(customerEmailCodesTable.usedAt)
      )
    );

  const code = generateEmailCode();
  await db.insert(customerEmailCodesTable).values({
    customerAccountId,
    code: hashCode(code),
    purpose,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
  });
  return code;
}

/**
 * Consumes a code. Returns true only if it is unused, unexpired, under the
 * attempt cap and matches.
 *
 * A failed attempt increments the counter on the row, so a wrong guess costs
 * the attacker one of five tries against a six-digit space. Comparison is
 * timing-safe; the codes are short and an attacker controls the submission, so
 * a length-dependent compare leaks more than it looks like it should.
 */
export async function consumeEmailCode(
  customerAccountId: number,
  purpose: "verify_email" | "password_reset",
  submitted: string
): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(customerEmailCodesTable)
    .where(
      and(
        eq(customerEmailCodesTable.customerAccountId, customerAccountId),
        eq(customerEmailCodesTable.purpose, purpose),
        isNull(customerEmailCodesTable.usedAt),
        gt(customerEmailCodesTable.expiresAt, now)
      )
    )
    .orderBy(desc(customerEmailCodesTable.createdAt))
    .limit(1);

  if (!row) return false;
  if (row.attempts >= MAX_CODE_ATTEMPTS) return false;

  const a = Buffer.from(hashCode(submitted));
  const b = Buffer.from(row.code);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    await db
      .update(customerEmailCodesTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(customerEmailCodesTable.id, row.id));
    return false;
  }

  await db
    .update(customerEmailCodesTable)
    .set({ usedAt: now })
    .where(eq(customerEmailCodesTable.id, row.id));
  return true;
}

/** Never returns passwordHash. Shape this deliberately rather than spreading the row. */
export function customerToProfile(c: CustomerAccount) {
  return {
    id: c.id,
    email: c.email,
    fullName: c.fullName,
    status: c.status,
    emailVerifiedAt: c.emailVerifiedAt,
    createdAt: c.createdAt,
  };
}

export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  const now = new Date();
  const [session] = await db
    .select({ customerAccountId: customerSessionsTable.customerAccountId })
    .from(customerSessionsTable)
    .where(and(eq(customerSessionsTable.token, token), gt(customerSessionsTable.expiresAt, now)))
    .limit(1);

  if (!session) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  const [account] = await db
    .select()
    .from(customerAccountsTable)
    .where(eq(customerAccountsTable.id, session.customerAccountId))
    .limit(1);

  // "active" only. A suspended customer holding a still-valid token must not
  // keep working until it expires.
  if (!account || account.status !== "active") {
    res.status(401).json({ error: "Unauthorized", message: "Account not found or inactive" });
    return;
  }

  (req as any).customer = account;
  next();
}

export function getReqCustomer(req: Request): CustomerAccount {
  return (req as any).customer as CustomerAccount;
}
