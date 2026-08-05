import { Router, type IRouter } from "express";
import {
  db, affiliatesTable, referralClicksTable, whopMembershipsTable,
  commissionsTable, paymentsTable, whopCustomersTable, campaignLinksTable,
  usersTable, leadSignupsTable, supportTicketsTable, supportTicketMessagesTable
} from "@workspace/db";
import { eq, desc, count, sql, and, gte, ne, isNotNull } from "drizzle-orm";
import { requireAffiliate } from "../lib/auth";

const router: IRouter = Router();

async function getAffiliateFromUser(userId: number) {
  const aff = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId)).limit(1);
  return aff[0];
}

router.get("/dashboard", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const days = parseInt(req.query.days as string ?? "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [[totalClicks], [uniqueClicks], [paidCustomers], [activeCustomers], [canceledCustomers], [revenue], [unpaid], [paid], [signups], clicksOverTime, salesOverTime, topCountries] = await Promise.all([
      db.select({ count: count() }).from(referralClicksTable).where(eq(referralClicksTable.affiliateId, affiliate.id)),
      db.select({ count: sql<number>`COUNT(DISTINCT ip_hash)` }).from(referralClicksTable).where(eq(referralClicksTable.affiliateId, affiliate.id)),
      db.select({ count: count() }).from(whopMembershipsTable).where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), eq(whopMembershipsTable.status, "active"))),
      db.select({ count: count() }).from(whopMembershipsTable).where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), eq(whopMembershipsTable.status, "active"))),
      db.select({ count: count() }).from(whopMembershipsTable).where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), eq(whopMembershipsTable.status, "expired"))),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` }).from(paymentsTable).where(and(eq(paymentsTable.affiliateId, affiliate.id), eq(paymentsTable.status, "paid"))),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable).where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "pending"))),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable).where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "paid"))),
      // Signups = new memberships attributed to this affiliate (all time)
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.affiliateId, affiliate.id)),
      db.select({ date: sql<string>`DATE(clicked_at)`, value: count() }).from(referralClicksTable).where(and(eq(referralClicksTable.affiliateId, affiliate.id), gte(referralClicksTable.clickedAt, since))).groupBy(sql`DATE(clicked_at)`).orderBy(sql`DATE(clicked_at)`),
      db.select({ date: sql<string>`DATE(paid_at)`, value: count() }).from(paymentsTable).where(and(eq(paymentsTable.affiliateId, affiliate.id), gte(paymentsTable.paidAt, since))).groupBy(sql`DATE(paid_at)`).orderBy(sql`DATE(paid_at)`),
      db.select({ country: referralClicksTable.country, total: count() }).from(referralClicksTable).where(and(eq(referralClicksTable.affiliateId, affiliate.id), isNotNull(referralClicksTable.country))).groupBy(referralClicksTable.country).orderBy(desc(count())).limit(10),
    ]);

    const tc = Number(totalClicks?.count ?? 0);
    const pc = Number(paidCustomers?.count ?? 0);
    const totalCtyClicks = topCountries.reduce((s, x) => s + Number(x.total), 0);

    const clicksByDay = clicksOverTime.map(r => ({ date: String(r.date), value: Number(r.value) }));
    const commissionRate = affiliate.defaultCommissionValue ? parseFloat(String(affiliate.defaultCommissionValue)) : 25;
    const paymentMethod = affiliate.payoutMethod ?? null;
    res.json({
      totalClicks: tc,
      uniqueClicks: Number(uniqueClicks?.count ?? 0),
      totalSignups: Number(signups?.count ?? 0),
      paidCustomers: pc,
      activeCustomers: Number(activeCustomers?.count ?? 0),
      canceledCustomers: Number(canceledCustomers?.count ?? 0),
      conversionRate: tc > 0 ? (pc / tc) * 100 : 0,
      revenueGenerated: Number(revenue?.total ?? 0),
      unpaidCommissions: Number(unpaid?.total ?? 0),
      paidCommissions: Number(paid?.total ?? 0),
      referralLink: affiliate.referralUrl,
      affiliateCode: affiliate.affiliateCode,
      commissionRate,
      paymentMethod,
      clicksByDay,
      clicksOverTime: clicksByDay,
      salesOverTime: salesOverTime.map(r => ({ date: String(r.date), value: Number(r.value) })),
      topCountries: topCountries.map(s => ({
        country: s.country ?? "Unknown", count: Number(s.total),
        percentage: totalCtyClicks > 0 ? (Number(s.total) / totalCtyClicks) * 100 : 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate dashboard error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/customers", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { page = "1", limit = "20", status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const memberships = await db.select({ m: whopMembershipsTable, c: whopCustomersTable })
      .from(whopMembershipsTable)
      .leftJoin(whopCustomersTable, eq(whopMembershipsTable.whopUserId, whopCustomersTable.whopUserId))
      .where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), status ? eq(whopMembershipsTable.status, status as string) : undefined))
      .orderBy(desc(whopMembershipsTable.createdAt)).limit(limitNum).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(whopMembershipsTable)
      .where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), status ? eq(whopMembershipsTable.status, status as string) : undefined));

    const results = await Promise.all(memberships.map(async ({ m, c }) => {
      // Per-membership: revenue and commissions earned
      const [rev] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` })
        .from(paymentsTable).where(eq(paymentsTable.whopMembershipId, m.whopMembershipId));
      const [comm] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable)
        .where(and(
          eq(commissionsTable.affiliateId, affiliate.id),
          sql`${commissionsTable.paymentId} IN (SELECT id FROM payments WHERE whop_membership_id = ${m.whopMembershipId})`
        ));
      const firstPayment = await db.select().from(paymentsTable)
        .where(and(eq(paymentsTable.whopMembershipId, m.whopMembershipId), eq(paymentsTable.paymentType, "initial")))
        .orderBy(desc(paymentsTable.paidAt)).limit(1);
      return {
        id: m.id,
        whopMembershipId: m.whopMembershipId,
        email: c?.email ?? null,
        name: c?.fullName ?? null,
        country: c?.country ?? null,
        membershipStatus: m.status,
        planId: m.whopPlanId ?? null,
        totalRevenue: Number(rev?.total ?? 0),
        yourEarnings: Number(comm?.total ?? 0),
        joinedAt: firstPayment[0]?.paidAt ?? m.startDate,
        renewalDate: m.renewalDate,
        canceledAt: (m.status === "expired" || m.status === "canceled") ? m.renewalDate : null,
      };
    }));

    const [activeResult] = await db.select({ count: count() }).from(whopMembershipsTable)
      .where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), eq(whopMembershipsTable.status, "active")));
    const totalCustomers = Number(totalResult?.count ?? 0);
    const activeMembers = Number(activeResult?.count ?? 0);

    res.json({
      customers: results,
      totalCustomers,
      activeMembers,
      retentionRate: totalCustomers > 0 ? (activeMembers / totalCustomers) * 100 : 0,
      total: totalCustomers, page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate customers error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/commissions", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where = and(eq(commissionsTable.affiliateId, affiliate.id), status ? eq(commissionsTable.commissionStatus, status as any) : undefined);
    const commissions = await db.select().from(commissionsTable).where(where)
      .orderBy(desc(commissionsTable.createdAt)).limit(limitNum).offset(offset);
    const [totalResult] = await db.select({ count: count() }).from(commissionsTable).where(where);
    const [unpaid] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable)
      .where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "pending")));
    const [paidTotal] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable)
      .where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "paid")));

    const totalUnpaid = Number(unpaid?.total ?? 0);
    const totalPaid = Number(paidTotal?.total ?? 0);
    res.json({
      commissions: commissions.map(c => ({
        id: c.id,
        customerEmail: null,
        customerName: null,
        saleAmount: null,
        amount: parseFloat(String(c.commissionAmount ?? 0)),
        commissionType: c.reason?.includes("Renewal") ? "recurring" : "initial",
        status: c.commissionStatus,
        rateType: (c.commissionType === "percent" || c.commissionType === "percentage") ? "percent" : "fixed",
        rateValue: parseFloat(String(c.commissionValue ?? 0)),
        createdAt: c.createdAt, paidAt: c.paidAt,
      })),
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
      totalEarned: totalUnpaid + totalPaid,
      totalPending: totalUnpaid,
      totalPaid: totalPaid,
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate commissions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/payouts", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { payoutsTable: pt } = await import("@workspace/db");
    const [payouts, pendingCommissions, paidPayoutsResult, pendingPayoutsResult] = await Promise.all([
      db.select().from(pt).where(eq(pt.affiliateId, affiliate.id)).orderBy(desc(pt.createdAt)),
      // Available balance = sum of pending commissions (approved but not yet requested as payout)
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable)
        .where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "pending"))),
      // Total paid out = sum of completed payouts
      db.select({ total: sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0)` })
        .from(pt)
        .where(and(eq(pt.affiliateId, affiliate.id), eq(pt.status, "paid"))),
      // Pending payout requests
      db.select({ total: sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0)` })
        .from(pt)
        .where(and(eq(pt.affiliateId, affiliate.id), eq(pt.status, "pending"))),
    ]);

    const pendingCommissionsTotal = Number(pendingCommissions[0]?.total ?? 0);
    const totalPaid = Number(paidPayoutsResult[0]?.total ?? 0);
    const pendingAmount = Number(pendingPayoutsResult[0]?.total ?? 0);
    // Available balance = pending commissions minus any already-requested payout amounts
    const availableBalance = Math.max(0, pendingCommissionsTotal - pendingAmount);

    res.json({
      availableBalance,
      pendingAmount,
      totalPaid,
      payouts: payouts.map(p => ({
        id: p.id,
        amount: parseFloat(String(p.totalAmount ?? 0)),
        paymentMethod: p.payoutMethod,
        status: p.status,
        transactionId: p.payoutReference,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate payouts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/payouts/request", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { paymentMethod, paymentDetails } = req.body;
    if (!paymentMethod || !paymentDetails) {
      res.status(400).json({ error: "paymentMethod and paymentDetails are required" }); return;
    }

    const { payoutsTable: pt } = await import("@workspace/db");
    // Calculate available balance = pending commissions minus already-requested pending payouts
    const [[pendingCommissions], [existingPending]] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
        .from(commissionsTable)
        .where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "pending"))),
      db.select({ total: sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0)` })
        .from(pt)
        .where(and(eq(pt.affiliateId, affiliate.id), eq(pt.status, "pending"))),
    ]);

    const availableAmount = Math.max(0, Number(pendingCommissions?.total ?? 0) - Number(existingPending?.total ?? 0));
    if (availableAmount <= 0) {
      res.status(400).json({ error: "No available balance to request payout. You may already have a pending payout request." }); return;
    }
    if (paymentMethod === "bank_transfer" && availableAmount < 500) {
      res.status(400).json({ error: "Wire transfers require a minimum of $500. Your current balance is $" + availableAmount.toFixed(2) + "." }); return;
    }

    const [payout] = await db.insert(pt).values({
      affiliateId: affiliate.id,
      totalAmount: String(availableAmount),
      currency: "USD",
      payoutMethod: paymentMethod,
      payoutReference: paymentDetails,
      status: "pending",
      notes: `Requested via affiliate portal`,
    }).returning();

    req.log.info({ affiliateId: affiliate.id, amount: availableAmount }, "Affiliate payout requested");
    res.status(201).json({ success: true, payout: { ...payout, amount: parseFloat(String(payout.totalAmount)) * 100 } });
  } catch (err) {
    req.log.error({ err }, "Affiliate payout request error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const days = parseInt(req.query.days as string ?? "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalClicksResult, uniqueClicksResult, totalSignupsResult, totalCustomersResult, clicksByDay, salesOverTime, countryStats, sourceStats, landingStats] = await Promise.all([
      db.select({ count: count() }).from(referralClicksTable)
        .where(and(eq(referralClicksTable.affiliateId, affiliate.id), gte(referralClicksTable.clickedAt, since))),
      db.select({ count: sql<number>`COUNT(DISTINCT ip_hash)` }).from(referralClicksTable)
        .where(and(eq(referralClicksTable.affiliateId, affiliate.id), gte(referralClicksTable.clickedAt, since))),
      // totalSignups = new memberships attributed to this affiliate in the time window
      db.select({ count: count() }).from(whopMembershipsTable)
        .where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), gte(whopMembershipsTable.startDate, since))),
      // totalCustomers = all active memberships attributed to this affiliate (all time)
      db.select({ count: count() }).from(whopMembershipsTable)
        .where(and(eq(whopMembershipsTable.affiliateId, affiliate.id), eq(whopMembershipsTable.status, "active"))),
      db.select({ date: sql<string>`DATE(clicked_at)`, value: count() }).from(referralClicksTable)
        .where(and(eq(referralClicksTable.affiliateId, affiliate.id), gte(referralClicksTable.clickedAt, since)))
        .groupBy(sql`DATE(clicked_at)`).orderBy(sql`DATE(clicked_at)`),
      db.select({ date: sql<string>`DATE(paid_at)`, value: count() }).from(paymentsTable)
        .where(and(eq(paymentsTable.affiliateId, affiliate.id), gte(paymentsTable.paidAt, since)))
        .groupBy(sql`DATE(paid_at)`).orderBy(sql`DATE(paid_at)`),
      db.select({ country: referralClicksTable.country, total: count() }).from(referralClicksTable)
        .where(and(eq(referralClicksTable.affiliateId, affiliate.id), isNotNull(referralClicksTable.country)))
        .groupBy(referralClicksTable.country).orderBy(desc(count())).limit(10),
      db.select({ source: referralClicksTable.utmSource, total: count() }).from(referralClicksTable)
        .where(eq(referralClicksTable.affiliateId, affiliate.id))
        .groupBy(referralClicksTable.utmSource).orderBy(desc(count())).limit(10),
      db.select({ page: referralClicksTable.landingPage, total: count() }).from(referralClicksTable)
        .where(eq(referralClicksTable.affiliateId, affiliate.id))
        .groupBy(referralClicksTable.landingPage).orderBy(desc(count())).limit(10),
    ]);

    const totalClicks = Number(totalClicksResult[0]?.count ?? 0);
    const uniqueVisitors = Number(uniqueClicksResult[0]?.count ?? 0);
    const totalSignups = Number(totalSignupsResult[0]?.count ?? 0);
    const totalCustomers = Number(totalCustomersResult[0]?.count ?? 0);
    const totalCty = countryStats.reduce((s, x) => s + Number(x.total), 0);
    const totalSrc = sourceStats.reduce((s, x) => s + Number(x.total), 0);

    res.json({
      totalClicks,
      uniqueVisitors,
      totalSignups,
      conversionRate: totalClicks > 0 ? (totalCustomers / totalClicks) * 100 : 0,
      clicksByDay: clicksByDay.map(r => ({ date: String(r.date), value: Number(r.value) })),
      salesOverTime: salesOverTime.map(r => ({ date: String(r.date), value: Number(r.value) })),
      clicksByCountry: countryStats.map(s => ({ country: s.country ?? "Unknown", count: Number(s.total), percentage: totalCty > 0 ? (Number(s.total) / totalCty) * 100 : 0 })),
      clicksBySource: sourceStats.map(s => ({ source: s.source ?? "Direct", count: Number(s.total), percentage: totalSrc > 0 ? (Number(s.total) / totalSrc) * 100 : 0 })),
      topLandingPages: landingStats.map(s => ({ page: s.page ?? "/", count: Number(s.total) })),
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate analytics error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/links", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const links = await db.select().from(campaignLinksTable).where(eq(campaignLinksTable.affiliateId, affiliate.id))
      .orderBy(desc(campaignLinksTable.createdAt));

    res.json({
      primaryLink: affiliate.referralUrl, affiliateCode: affiliate.affiliateCode,
      campaignLinks: links.map(l => ({ ...l, clicks: Number(l.clicks) })),
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate links error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/links", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { name, utmSource, utmMedium, utmCampaign, landingPage } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "name required" }); return; }

    const baseUrl = process.env.BASE_URL ?? "https://affiliates1of1trader.pro";
    const params = new URLSearchParams();
    params.set("ref", affiliate.affiliateCode);
    if (utmSource) params.set("utm_source", utmSource);
    if (utmMedium) params.set("utm_medium", utmMedium);
    if (utmCampaign) params.set("utm_campaign", utmCampaign);

    const targetPage = landingPage ?? "/";
    const url = `${baseUrl}${targetPage}?${params.toString()}`;

    const [link] = await db.insert(campaignLinksTable).values({
      affiliateId: affiliate.id, name, url,
      utmSource: utmSource ?? null, utmMedium: utmMedium ?? null, utmCampaign: utmCampaign ?? null,
      landingPage: landingPage ?? null, clicks: 0,
    }).returning();

    res.status(201).json({ ...link, clicks: Number(link.clicks) });
  } catch (err) {
    req.log.error({ err }, "Create campaign link error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/profile", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { affiliateApplicationsTable } = await import("@workspace/db");
    const app = await db.select().from(affiliateApplicationsTable)
      .where(eq(affiliateApplicationsTable.email, user.email)).limit(1);

    res.json({
      id: user.id, email: user.email, fullName: user.fullName,
      phone: app[0]?.phone ?? null, country: app[0]?.country ?? null,
      telegram: app[0]?.telegram ?? null, discord: app[0]?.discord ?? null,
      payoutMethod: affiliate.payoutMethod, payoutDetails: affiliate.payoutDetails,
      affiliateCode: affiliate.affiliateCode, referralUrl: affiliate.referralUrl,
      websiteUrl: app[0]?.websiteUrl ?? null,
      twitterUrl: app[0]?.twitterUrl ?? null,
      youtubeUrl: app[0]?.youtubeUrl ?? null,
      commissionRate: affiliate.defaultCommissionValue ? parseFloat(String(affiliate.defaultCommissionValue)) : 25,
    });
  } catch (err) {
    req.log.error({ err }, "Affiliate profile error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/profile", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await getAffiliateFromUser(user.id);
    if (!affiliate) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

    const { fullName, phone, telegram, discord, payoutMethod, payoutDetails } = req.body;
    if (fullName) await db.update(usersTable).set({ fullName }).where(eq(usersTable.id, user.id));
    await db.update(affiliatesTable).set({
      payoutMethod: payoutMethod ?? affiliate.payoutMethod,
      payoutDetails: payoutDetails ?? affiliate.payoutDetails,
    }).where(eq(affiliatesTable.id, affiliate.id));
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/support", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { subject, category, message } = req.body;
    if (!subject || !message) {
      res.status(400).json({ error: "Bad Request", message: "Subject and message required" });
      return;
    }

    const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
    const affiliateId = affiliate[0]?.id ?? 0;
    const senderName = user.fullName ?? user.email;

    const [ticket] = await db.insert(supportTicketsTable).values({
      affiliateId,
      affiliateName: senderName,
      affiliateEmail: user.email,
      category: category ?? null,
      subject,
      message,
      status: "open",
    }).returning();

    // Insert the initial message into the thread
    await db.insert(supportTicketMessagesTable).values({
      ticketId: ticket.id,
      senderType: "affiliate",
      senderName,
      message,
    });

    const { sendSupportTicketNotification } = await import("../lib/email");
    sendSupportTicketNotification(senderName, user.email, subject, category, message)
      .catch((err: any) => req.log.error({ err }, "Failed to send support ticket email"));

    res.json({ success: true, ticketId: ticket.id, message: "Support ticket submitted." });
  } catch (err) {
    req.log.error({ err }, "Support ticket error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// List affiliate's own tickets
router.get("/support/tickets", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
    const affiliateId = affiliate[0]?.id;
    if (!affiliateId) { res.json([]); return; }

    const tickets = await db.select().from(supportTicketsTable)
      .where(eq(supportTicketsTable.affiliateId, affiliateId))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(50);
    res.json(tickets);
  } catch (err) {
    req.log.error({ err }, "List tickets error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get messages for a ticket (affiliate must own it)
router.get("/support/tickets/:id/messages", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const ticketId = parseInt(req.params.id as string);
    const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
    const affiliateId = affiliate[0]?.id;

    const ticket = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId)).limit(1);
    if (!ticket[0] || ticket[0].affiliateId !== affiliateId) { res.status(403).json({ error: "Forbidden" }); return; }

    const messages = await db.select().from(supportTicketMessagesTable)
      .where(eq(supportTicketMessagesTable.ticketId, ticketId))
      .orderBy(supportTicketMessagesTable.createdAt);
    res.json({ ticket: ticket[0], messages });
  } catch (err) {
    req.log.error({ err }, "Get ticket messages error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Affiliate sends a follow-up reply
router.post("/support/tickets/:id/reply", requireAffiliate, async (req, res) => {
  try {
    const user = (req as any).user;
    const ticketId = parseInt(req.params.id as string);
    const { message } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

    const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, user.id)).limit(1);
    const affiliateId = affiliate[0]?.id;

    const ticket = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId)).limit(1);
    if (!ticket[0] || ticket[0].affiliateId !== affiliateId) { res.status(403).json({ error: "Forbidden" }); return; }

    // Re-open closed tickets when affiliate replies
    if (ticket[0].status === "closed" || ticket[0].status === "resolved") {
      await db.update(supportTicketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticketId));
    }

    const [msg] = await db.insert(supportTicketMessagesTable).values({
      ticketId,
      senderType: "affiliate",
      senderName: user.fullName ?? user.email,
      message: message.trim(),
    }).returning();

    res.json(msg);
  } catch (err) {
    req.log.error({ err }, "Affiliate reply error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
