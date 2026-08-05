import { Router, type IRouter } from "express";
import { db, paymentsTable, commissionsTable, whopMembershipsTable, affiliatesTable, usersTable } from "@workspace/db";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/finance", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      [grossRow], [thisMonthRow], [lastMonthRow],
      [commAccruedRow], [commPaidRow], [commPendingRow],
      [totalMembersRow], [activeMembersRow],
      revenueByPlan, revenueByAffiliate,
      dailySalesRaw,
    ] = await Promise.all([
      // Gross revenue all time
      db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` })
        .from(paymentsTable).where(eq(paymentsTable.status, "paid")),
      // This month
      db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` })
        .from(paymentsTable).where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, startOfMonth))),
      // Last month
      db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` })
        .from(paymentsTable).where(and(
          eq(paymentsTable.status, "paid"),
          gte(paymentsTable.paidAt, startOfLastMonth),
          sql`paid_at <= ${endOfLastMonth.toISOString()}`,
        )),
      // Commissions accrued (all time, all statuses)
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable),
      // Commissions paid
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable).where(eq(commissionsTable.commissionStatus, "paid")),
      // Commissions pending (liability)
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable).where(eq(commissionsTable.commissionStatus, "pending")),
      // Total members
      db.select({ total: sql<number>`COUNT(*)` }).from(whopMembershipsTable),
      // Active members
      db.select({ total: sql<number>`COUNT(*)` }).from(whopMembershipsTable)
        .where(eq(whopMembershipsTable.status, "active")),
      // Revenue by payment type (initial vs recurring)
      db.select({
        paymentType: paymentsTable.paymentType,
        total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
        txCount: sql<number>`COUNT(*)`,
      }).from(paymentsTable).where(eq(paymentsTable.status, "paid"))
        .groupBy(paymentsTable.paymentType)
        .orderBy(desc(sql`SUM(CAST(gross_amount AS NUMERIC))`))
        .limit(10),
      // Revenue by affiliate (no correlated subquery — keep select simple)
      db.select({
        affiliateId: paymentsTable.affiliateId,
        total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
        txCount: sql<number>`COUNT(*)`,
      }).from(paymentsTable).where(and(eq(paymentsTable.status, "paid"), sql`affiliate_id IS NOT NULL`))
        .groupBy(paymentsTable.affiliateId)
        .orderBy(desc(sql`SUM(CAST(gross_amount AS NUMERIC))`))
        .limit(10),
      // Daily sales last 30 days
      db.select({
        date: sql<string>`DATE(paid_at)`,
        revenue: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(paymentsTable)
        .where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, thirtyDaysAgo)))
        .groupBy(sql`DATE(paid_at)`)
        .orderBy(sql`DATE(paid_at)`),
    ]);

    // Enrich affiliate revenue with affiliate names
    const affiliateIds = revenueByAffiliate.map(r => r.affiliateId).filter(Boolean) as number[];
    let affiliateNames: Record<number, string> = {};
    if (affiliateIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const rows = await db.select({
        id: affiliatesTable.id,
        name: usersTable.fullName,
        code: affiliatesTable.affiliateCode,
      }).from(affiliatesTable)
        .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
        .where(inArray(affiliatesTable.id, affiliateIds));
      affiliateNames = Object.fromEntries(rows.map(r => [r.id, r.name ?? r.code ?? 'Unknown']));
    }

    const grossRevenue = Number(grossRow?.total ?? 0);
    const thisMonthRevenue = Number(thisMonthRow?.total ?? 0);
    const lastMonthRevenue = Number(lastMonthRow?.total ?? 0);
    const totalTx = dailySalesRaw.reduce((s, r) => s + Number(r.count), 0);
    const aov = totalTx > 0 ? grossRevenue / totalTx : 0;
    const commissionsAccrued = Number(commAccruedRow?.total ?? 0);
    const commissionsPaid = Number(commPaidRow?.total ?? 0);
    const commissionLiability = Number(commPendingRow?.total ?? 0);
    const netRevenue = grossRevenue - commissionsAccrued;

    // MRR: sum of current active memberships' average monthly payment
    // Approximation: thisMonth / days_elapsed * 30
    const dayOfMonth = now.getDate();
    const mrr = dayOfMonth > 0 ? (thisMonthRevenue / dayOfMonth) * 30 : 0;

    res.json({
      grossRevenue,
      netRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      mrr,
      arr: mrr * 12,
      aov,
      totalTransactions: totalTx,
      commissionsAccrued,
      commissionsPaid,
      commissionLiability,
      totalMembers: Number(totalMembersRow?.total ?? 0),
      activeMembers: Number(activeMembersRow?.total ?? 0),
      revenueByPlan: revenueByPlan.map(r => ({
        planId: r.paymentType ?? 'Unknown',
        total: Number(r.total),
        txCount: Number(r.txCount),
      })),
      revenueByAffiliate: revenueByAffiliate.map(r => ({
        affiliateId: r.affiliateId,
        name: affiliateNames[r.affiliateId!] ?? 'Unknown',
        total: Number(r.total),
        txCount: Number(r.txCount),
      })),
      dailySales: dailySalesRaw.map(r => ({
        date: String(r.date),
        revenue: Number(r.revenue),
        count: Number(r.count),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Finance overview error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
