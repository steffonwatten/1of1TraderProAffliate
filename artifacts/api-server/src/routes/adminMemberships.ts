import { Router, type IRouter } from "express";
import { db, whopMembershipsTable, whopCustomersTable, affiliatesTable, usersTable, paymentsTable, commissionsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, count, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { whopFetch } from "../lib/whop";

const router: IRouter = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, affiliateId, country, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const memberships = await db.select({
      membership: whopMembershipsTable,
      customer: whopCustomersTable,
      affiliate: affiliatesTable,
      user: usersTable,
    })
      .from(whopMembershipsTable)
      .leftJoin(whopCustomersTable, eq(whopMembershipsTable.whopUserId, whopCustomersTable.whopUserId))
      .leftJoin(affiliatesTable, eq(whopMembershipsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(status ? eq(whopMembershipsTable.status, status as string) : undefined)
      .orderBy(desc(whopMembershipsTable.createdAt)).limit(limitNum).offset(offset);

    const [[totalResult], [activeResult], [trialingResult], [expiredResult], [completedResult], [canceledResult]] = await Promise.all([
      db.select({ count: count() }).from(whopMembershipsTable)
        .where(status ? eq(whopMembershipsTable.status, status as string) : undefined),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "active")),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "trialing")),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "expired")),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "completed")),
      db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.status, "canceled")),
    ]);

    // Batch-load revenue per membership
    const whopMembershipIds = memberships.map(m => m.membership.whopMembershipId).filter(Boolean) as string[];
    let revenueMap: Record<string, number> = {};
    if (whopMembershipIds.length > 0) {
      const revenueRows = await db.select({
        whopMembershipId: paymentsTable.whopMembershipId,
        total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)`,
      }).from(paymentsTable)
        .where(inArray(paymentsTable.whopMembershipId, whopMembershipIds))
        .groupBy(paymentsTable.whopMembershipId);
      revenueMap = Object.fromEntries(revenueRows.map(r => [r.whopMembershipId, Number(r.total)]));
    }

    res.json({
      memberships: memberships.map(({ membership, customer, affiliate, user }) => ({
        id: membership.id,
        whopMembershipId: membership.whopMembershipId,
        whopUserId: membership.whopUserId,
        whopProductId: membership.whopProductId,
        whopPlanId: membership.whopPlanId,
        customerEmail: customer?.email ?? null,
        customerName: customer?.fullName ?? null,
        customerCountry: customer?.country ?? null,
        affiliateId: membership.affiliateId,
        affiliateName: user?.fullName ?? null,
        status: membership.status,
        startDate: membership.startDate,
        renewalDate: membership.renewalDate,
        canceledAt: membership.canceledAt,
        createdAt: membership.createdAt,
        totalRevenue: revenueMap[membership.whopMembershipId ?? ''] ?? 0,
      })),
      total: Number(totalResult?.count ?? 0),
      totalActive: Number(activeResult?.count ?? 0),
      totalTrialing: Number(trialingResult?.count ?? 0),
      totalExpired: Number(expiredResult?.count ?? 0),
      totalCompleted: Number(completedResult?.count ?? 0),
      totalCanceled: Number(canceledResult?.count ?? 0),
      page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Get memberships error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /admin/memberships/:whopMembershipId/attribute
// Manually attribute a membership to an affiliate and fix any $0 payments from the same membership.
router.post("/:whopMembershipId/attribute", requireAdmin, async (req, res) => {
  try {
    const whopMembershipId = req.params.whopMembershipId as string;
    const { affiliateId } = req.body;

    if (!affiliateId) {
      res.status(400).json({ error: "affiliateId is required" });
      return;
    }

    const affiliate = await db.select().from(affiliatesTable)
      .where(eq(affiliatesTable.id, Number(affiliateId))).limit(1);
    if (!affiliate[0]) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    // 1. Update membership
    await db.update(whopMembershipsTable)
      .set({ affiliateId: Number(affiliateId), updatedAt: new Date() })
      .where(eq(whopMembershipsTable.whopMembershipId, whopMembershipId));

    // 2. Fix any payments for this membership that have $0 amount or no affiliate
    const payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.whopMembershipId, whopMembershipId));

    const commissionRate = Number(affiliate[0].defaultCommissionValue ?? 30) / 100;

    for (const p of payments) {
      const rawPayload = p.rawPayload ? JSON.parse(p.rawPayload as string) : null;
      // Whop v5 amounts are in DOLLARS (not cents)
      const rawAmount = rawPayload?.total ?? rawPayload?.usd_total ?? rawPayload?.final_amount ?? null;
      const amount = rawAmount != null ? rawAmount : Number(p.grossAmount ?? 0);

      await db.update(paymentsTable)
        .set({
          affiliateId: Number(affiliateId),
          grossAmount: String(amount),
          netAmount: String(amount),
        })
        .where(eq(paymentsTable.id, p.id));

      // Create commission if one doesn't already exist for this payment
      const existingComm = await db.select().from(commissionsTable)
        .where(eq(commissionsTable.paymentId, p.id)).limit(1);

      const commissionRatePct = Number(affiliate[0].defaultCommissionValue ?? 20);
      const commissionAmount = (amount * commissionRatePct) / 100;
      const commissionType = affiliate[0].defaultCommissionType ?? "percent";

      if (existingComm.length === 0 && amount > 0) {
        await db.insert(commissionsTable).values({
          affiliateId: Number(affiliateId),
          paymentId: p.id,
          commissionType,
          commissionValue: String(commissionRatePct),
          commissionAmount: String(commissionAmount),
          commissionStatus: "pending",
          reason: `Manual attribution - ${p.whopPaymentId}`,
        });
      } else if (existingComm.length > 0 && amount > 0) {
        await db.update(commissionsTable)
          .set({
            affiliateId: Number(affiliateId),
            commissionValue: String(commissionRatePct),
            commissionAmount: String(commissionAmount),
          })
          .where(eq(commissionsTable.paymentId, p.id));
      }
    }

    const admin = (req as any).user;
    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "attribute_membership",
      targetType: "membership",
      targetId: whopMembershipId,
      newValue: JSON.stringify({ affiliateId, paymentsFixed: payments.length }),
    });

    req.log.info({ whopMembershipId, affiliateId, paymentsFixed: payments.length }, "Admin manually attributed membership");
    res.json({ success: true, paymentsFixed: payments.length });
  } catch (err) {
    req.log.error({ err }, "Attribute membership error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/memberships/:id/detail — Customer detail page
router.get("/:id/detail", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const [row] = await db.select({
      membership: whopMembershipsTable,
      customer: whopCustomersTable,
      affiliate: affiliatesTable,
      user: usersTable,
    }).from(whopMembershipsTable)
      .leftJoin(whopCustomersTable, eq(whopMembershipsTable.whopUserId, whopCustomersTable.whopUserId))
      .leftJoin(affiliatesTable, eq(whopMembershipsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(eq(whopMembershipsTable.id, id)).limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { membership, customer, affiliate, user } = row;

    // Payment history + Whop membership data (for live renewal date) — parallel
    const whopMembId = membership.whopMembershipId ?? '';
    const [payments, whopMembData] = await Promise.all([
      db.select().from(paymentsTable)
        .where(eq(paymentsTable.whopMembershipId, whopMembId))
        .orderBy(desc(paymentsTable.paidAt)).limit(50),
      whopMembId
        ? whopFetch(`/company/memberships/${whopMembId}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    // planName: null here — frontend shows product name fallback ("1OF1 Trader Pro")
    const planName: string | null = null;

    // Renewal date: live from Whop membership (Unix timestamp), fallback to DB value
    const renewalDate = whopMembData?.renewal_period_end
      ? new Date(whopMembData.renewal_period_end * 1000).toISOString()
      : membership.renewalDate;

    // Commissions linked to this affiliate from this member's payments
    const paymentIds = payments.map(p => p.id);
    let commissions: any[] = [];
    if (paymentIds.length > 0) {
      commissions = await db.select().from(commissionsTable)
        .where(inArray(commissionsTable.paymentId, paymentIds))
        .orderBy(desc(commissionsTable.createdAt));
    }

    const totalPaid = payments.reduce((s, p) => s + Number(p.grossAmount ?? 0), 0);

    res.json({
      id: membership.id,
      whopMembershipId: membership.whopMembershipId,
      whopUserId: membership.whopUserId,
      whopProductId: membership.whopProductId,
      whopPlanId: membership.whopPlanId,
      planName,
      status: membership.status,
      startDate: membership.startDate,
      renewalDate,
      canceledAt: membership.canceledAt,
      createdAt: membership.createdAt,
      customer: customer ? {
        email: customer.email,
        fullName: customer.fullName,
        country: customer.country,
        avatarUrl: null,
        whopUsername: null,
      } : {
        email: null,
        fullName: null,
        country: null, avatarUrl: null, whopUsername: null,
      },
      affiliate: affiliate ? {
        id: affiliate.id,
        code: affiliate.affiliateCode,
        name: user?.fullName ?? null,
        email: user?.email ?? null,
        commissionRate: affiliate.defaultCommissionValue,
        commissionType: affiliate.defaultCommissionType,
      } : null,
      payments: payments.map(p => ({
        id: p.id,
        whopPaymentId: p.whopPaymentId,
        grossAmount: Number(p.grossAmount ?? 0),
        netAmount: Number(p.netAmount ?? 0),
        status: p.status,
        paidAt: p.paidAt,
        paymentType: p.paymentType,
      })),
      commissions: commissions.map(c => ({
        id: c.id,
        commissionAmount: Number(c.commissionAmount ?? 0),
        commissionStatus: c.commissionStatus,
        commissionType: c.commissionType,
        commissionValue: Number(c.commissionValue ?? 0),
        createdAt: c.createdAt,
      })),
      totalPaid,
    });
  } catch (err) {
    req.log.error({ err }, "Membership detail error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

