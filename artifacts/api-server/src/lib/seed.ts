import { db, usersTable, paymentsTable, whopMembershipsTable, commissionsTable, affiliatesTable, referralClicksTable } from "@workspace/db";
import { eq, and, sql, lte, gte, desc } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "./logger";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "1of1traderpro_salt").digest("hex");
}

export async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = "admin@1of1traderpro.com";
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, adminEmail))
      .limit(1);

    if (existing.length > 0) {
      logger.info("Admin account already exists, skipping seed");
    } else {
      await db.insert(usersTable).values({
        email: adminEmail,
        passwordHash: hashPassword("Admin1234!"),
        fullName: "Admin",
        role: "admin",
        status: "active",
        createdAt: new Date(),
      });
      logger.info("Admin account created successfully");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

// One-time startup backfill: fix any payments where the stored amount doesn't match
// the raw_payload amount (catches both $0 records and /100 division errors).
export async function backfillZeroAmountPayments(): Promise<void> {
  try {
    // Find all payments that have a raw_payload and a suspiciously low amount
    const zeroes = await db.select().from(paymentsTable)
      .where(sql`${paymentsTable.rawPayload} IS NOT NULL AND CAST(${paymentsTable.grossAmount} AS numeric) < 1`);

    if (zeroes.length === 0) return;

    for (const p of zeroes) {
      if (!p.rawPayload) continue;

      let raw: any;
      try { raw = JSON.parse(p.rawPayload as string); } catch { continue; }

      // Whop v5 amounts are in DOLLARS (not cents). total/usd_total = dollar value e.g. 9.98
      const rawAmount = raw?.total ?? raw?.usd_total ?? raw?.final_amount ?? null;
      if (rawAmount == null || rawAmount <= 0) continue;

      const amount = rawAmount; // Already in dollars — no division needed

      // Get affiliate from payment → membership → recent referral clicks (last-click fallback)
      let affiliateId = p.affiliateId;
      if (!affiliateId && p.whopMembershipId) {
        const membership = await db.select().from(whopMembershipsTable)
          .where(eq(whopMembershipsTable.whopMembershipId, p.whopMembershipId)).limit(1);
        affiliateId = membership[0]?.affiliateId ?? null;
      }
      if (!affiliateId && p.paidAt) {
        // Look for referral clicks within 60 min before this payment
        const windowStart = new Date(new Date(p.paidAt).getTime() - 60 * 60 * 1000);
        const recentClicks = await db.select({ affiliateId: referralClicksTable.affiliateId })
          .from(referralClicksTable)
          .where(and(
            gte(referralClicksTable.clickedAt, windowStart),
            lte(referralClicksTable.clickedAt, new Date(p.paidAt)),
          ))
          .orderBy(desc(referralClicksTable.clickedAt))
          .limit(5);
        const uniqueAffiliates = [...new Set(recentClicks.map(c => c.affiliateId).filter(Boolean))];
        if (uniqueAffiliates.length >= 1) {
          affiliateId = uniqueAffiliates[0] as number;
          logger.info({ affiliateId, paymentId: p.id }, "Backfill: resolved affiliate via last-click fallback");
        }
      }

      // Update payment with correct amount and affiliate
      await db.update(paymentsTable)
        .set({ grossAmount: String(amount), netAmount: String(amount), affiliateId: affiliateId ?? undefined })
        .where(eq(paymentsTable.id, p.id));

      // Also fix the membership attribution
      if (affiliateId && p.whopMembershipId) {
        await db.update(whopMembershipsTable)
          .set({ affiliateId, updatedAt: new Date() })
          .where(and(
            eq(whopMembershipsTable.whopMembershipId, p.whopMembershipId),
            sql`${whopMembershipsTable.affiliateId} IS NULL`,
          ));
      }

      // Create commission if none exists and we have an affiliate
      if (affiliateId) {
        const existing = await db.select().from(commissionsTable)
          .where(eq(commissionsTable.paymentId, p.id)).limit(1);

        if (existing.length === 0) {
          const affiliate = await db.select().from(affiliatesTable)
            .where(eq(affiliatesTable.id, affiliateId)).limit(1);
          if (affiliate[0]) {
            const ratePct = Number(affiliate[0].defaultCommissionValue ?? 20);
            const commAmount = (amount * ratePct) / 100;
            await db.insert(commissionsTable).values({
              affiliateId,
              paymentId: p.id,
              commissionType: affiliate[0].defaultCommissionType ?? "percent",
              commissionValue: String(ratePct),
              commissionAmount: String(commAmount),
              commissionStatus: "pending",
              reason: `Backfill - ${p.whopPaymentId}`,
            });
            logger.info({ paymentId: p.id, amount, commAmount, affiliateId }, "Backfilled payment and created commission");
          }
        }
      } else {
        logger.info({ paymentId: p.id, amount }, "Backfilled payment amount (no affiliate found)");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to backfill zero-amount payments");
  }
}
