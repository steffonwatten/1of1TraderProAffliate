import { Router, type IRouter } from "express";
import {
  db, affiliatesTable, usersTable, affiliateApplicationsTable,
  referralClicksTable, whopMembershipsTable, paymentsTable, commissionsTable,
  adminAuditLogsTable, payoutsTable
} from "@workspace/db";
import { eq, desc, count, sql, and, gte, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/overview", requireAdmin, async (req, res) => {
  try {
    const [[totalAff], [activeAff], [pendingApps], [totalClicks], [totalPaid], [revenue], [owedComm], [paidComm]] = await Promise.all([
      db.select({ count: count() }).from(affiliatesTable),
      db.select({ count: count() }).from(affiliatesTable).where(eq(affiliatesTable.status, "active")),
      db.select({ count: count() }).from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.status, "pending")),
      db.select({ count: count() }).from(referralClicksTable),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "active")),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, "paid")),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable).where(eq(commissionsTable.commissionStatus, "pending")),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable).where(eq(commissionsTable.commissionStatus, "paid")),
    ]);

    const topAffiliates = await db.select({
      id: affiliatesTable.id,
      fullName: usersTable.fullName,
      affiliateCode: affiliatesTable.affiliateCode,
      revenue: sql<number>`COALESCE(SUM(CAST(${paymentsTable.grossAmount} AS NUMERIC)), 0)`,
      customers: count(paymentsTable.id),
      unpaidCommission: sql<number>`COALESCE((
        SELECT SUM(CAST(commission_amount AS NUMERIC)) FROM commissions
        WHERE affiliate_id = ${affiliatesTable.id} AND commission_status = 'pending'
      ), 0)`,
    })
      .from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .leftJoin(paymentsTable, eq(paymentsTable.affiliateId, affiliatesTable.id))
      .groupBy(affiliatesTable.id, usersTable.fullName, affiliatesTable.affiliateCode)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${paymentsTable.grossAmount} AS NUMERIC)), 0)`))
      .limit(5);

    const countryStats = await db.select({ country: referralClicksTable.country, total: count() })
      .from(referralClicksTable).where(isNotNull(referralClicksTable.country)).groupBy(referralClicksTable.country).orderBy(desc(count())).limit(10);
    const totalCountryClicks = countryStats.reduce((sum, s) => sum + Number(s.total), 0);

    const sourceStats = await db.select({ source: referralClicksTable.utmSource, total: count() })
      .from(referralClicksTable).groupBy(referralClicksTable.utmSource).orderBy(desc(count())).limit(10);
    const totalSourceClicks = sourceStats.reduce((sum, s) => sum + Number(s.total), 0);

    const recentLogs = await db.select({ log: adminAuditLogsTable, email: usersTable.email })
      .from(adminAuditLogsTable).leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
      .orderBy(desc(adminAuditLogsTable.createdAt)).limit(10);

    const [totalSignups] = await db.select({ count: count() }).from(whopMembershipsTable);

    // Daily sales for the last 30 days (all payments, not just attributed)
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const salesByDayRaw = await db.select({
      date: sql<string>`DATE(paid_at)`,
      revenue: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
      sales: count(),
    }).from(paymentsTable)
      .where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, since30)))
      .groupBy(sql`DATE(paid_at)`)
      .orderBy(sql`DATE(paid_at)`);

    res.json({
      totalAffiliates: Number(totalAff?.count ?? 0),
      activeAffiliates: Number(activeAff?.count ?? 0),
      pendingApplications: Number(pendingApps?.count ?? 0),
      totalClicks: Number(totalClicks?.count ?? 0),
      totalSignups: Number(totalSignups?.count ?? 0),
      totalPaidCustomers: Number(totalPaid?.count ?? 0),
      totalAttributedRevenue: Number(revenue?.total ?? 0),
      totalCommissionsOwed: Number(owedComm?.total ?? 0),
      totalCommissionsPaid: Number(paidComm?.total ?? 0),
      salesByDay: salesByDayRaw.map(r => ({
        date: String(r.date),
        revenue: Number(r.revenue),
        sales: Number(r.sales),
      })),
      topAffiliates: topAffiliates.map(a => ({
        id: a.id, fullName: a.fullName ?? "Unknown", affiliateCode: a.affiliateCode,
        totalRevenue: Number(a.revenue ?? 0), totalCustomers: Number(a.customers ?? 0),
        unpaidCommission: Number(a.unpaidCommission ?? 0),
      })),
      clicksByCountry: countryStats.map(s => ({
        country: s.country ?? "Unknown", count: Number(s.total),
        percentage: totalCountryClicks > 0 ? (Number(s.total) / totalCountryClicks) * 100 : 0,
      })),
      clicksBySource: sourceStats.map(s => ({
        source: s.source ?? "Direct", count: Number(s.total),
        percentage: totalSourceClicks > 0 ? (Number(s.total) / totalSourceClicks) * 100 : 0,
      })),
      recentActivity: recentLogs.map(({ log, email }) => ({
        type: log.action, description: `${email ?? "Admin"}: ${log.action} on ${log.targetType} ${log.targetId ?? ""}`, createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get admin overview error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const days = parseInt((req.query.days as string) ?? "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      clicksByDayRaw,
      totalClicksRow,
      uniqueVisitorsRow,
      totalSignupsRow,
      countryStats,
      sourceStats,
    ] = await Promise.all([
      db.select({
        date: sql<string>`DATE(clicked_at)`,
        clicks: count(),
      }).from(referralClicksTable)
        .where(gte(referralClicksTable.clickedAt, since))
        .groupBy(sql`DATE(clicked_at)`).orderBy(sql`DATE(clicked_at)`),

      db.select({ total: count() }).from(referralClicksTable)
        .where(gte(referralClicksTable.clickedAt, since)),

      db.select({ total: sql<number>`COUNT(DISTINCT ip_hash)` })
        .from(referralClicksTable)
        .where(gte(referralClicksTable.clickedAt, since)),

      // Attributed signups only (memberships that came via a referral link)
      db.select({ total: count() }).from(whopMembershipsTable)
        .where(and(gte(whopMembershipsTable.createdAt, since), sql`affiliate_id IS NOT NULL`)),

      db.select({ country: referralClicksTable.country, total: count() })
        .from(referralClicksTable)
        .where(and(gte(referralClicksTable.clickedAt, since), isNotNull(referralClicksTable.country)))
        .groupBy(referralClicksTable.country).orderBy(desc(count())).limit(10),

      db.select({ source: referralClicksTable.utmSource, total: count() })
        .from(referralClicksTable)
        .where(gte(referralClicksTable.clickedAt, since))
        .groupBy(referralClicksTable.utmSource).orderBy(desc(count())).limit(10),
    ]);

    const totalClicks = Number(totalClicksRow[0]?.total ?? 0);
    const uniqueVisitors = Number(uniqueVisitorsRow[0]?.total ?? 0);
    const totalSignups = Number(totalSignupsRow[0]?.total ?? 0);
    const conversionRate = totalClicks > 0 ? (totalSignups / totalClicks) * 100 : 0;
    const totalCountryClicks = countryStats.reduce((sum, s) => sum + Number(s.total), 0);
    const totalSourceClicks = sourceStats.reduce((sum, s) => sum + Number(s.total), 0);

    // Daily sales for the analytics date range
    const salesByDayRaw = await db.select({
      date: sql<string>`DATE(paid_at)`,
      revenue: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
      sales: count(),
    }).from(paymentsTable)
      .where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, since)))
      .groupBy(sql`DATE(paid_at)`)
      .orderBy(sql`DATE(paid_at)`);

    const totalRevenue = salesByDayRaw.reduce((sum, r) => sum + Number(r.revenue), 0);

    res.json({
      totalClicks,
      uniqueVisitors,
      totalSignups,
      conversionRate,
      totalRevenue,
      clicksByDay: clicksByDayRaw.map(r => ({ date: String(r.date), clicks: Number(r.clicks) })),
      salesByDay: salesByDayRaw.map(r => ({
        date: String(r.date),
        revenue: Number(r.revenue),
        sales: Number(r.sales),
      })),
      clicksByCountry: countryStats.map(s => ({
        country: s.country ?? "Unknown",
        count: Number(s.total),
        percentage: totalCountryClicks > 0 ? (Number(s.total) / totalCountryClicks) * 100 : 0,
      })),
      clicksBySource: sourceStats.map(s => ({
        source: s.source ?? "Direct",
        count: Number(s.total),
        percentage: totalSourceClicks > 0 ? (Number(s.total) / totalSourceClicks) * 100 : 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get analytics error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
