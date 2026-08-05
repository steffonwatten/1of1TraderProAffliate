import { Router, type IRouter } from "express";
import {
  db, affiliatesTable, usersTable, affiliateCommissionRulesTable,
  referralClicksTable, whopMembershipsTable, paymentsTable,
  commissionsTable, adminAuditLogsTable, payoutsTable,
  userSessionsTable, passwordResetTokensTable, campaignLinksTable,
  supportTicketsTable, supportTicketMessagesTable
} from "@workspace/db";
import { eq, desc, count, sql, and, ilike, or, isNotNull } from "drizzle-orm";
import { requireAdmin, hashPassword } from "../lib/auth";

const router: IRouter = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20", search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const affiliates = await db.select({
      affiliate: affiliatesTable,
      user: usersTable,
    })
      .from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(status ? eq(affiliatesTable.status, status as any) : undefined)
      .orderBy(desc(affiliatesTable.createdAt))
      .limit(limitNum).offset(offset);

    const totalResult = await db.select({ count: count() }).from(affiliatesTable)
      .where(status ? eq(affiliatesTable.status, status as any) : undefined);

    const results = await Promise.all(affiliates.map(async ({ affiliate, user }) => {
      const [clicks] = await db.select({ total: count() }).from(referralClicksTable).where(eq(referralClicksTable.affiliateId, affiliate.id));
      const [customers] = await db.select({ total: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.affiliateId, affiliate.id));
      const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.affiliateId, affiliate.id));
      const [unpaid] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable)
        .where(and(eq(commissionsTable.affiliateId, affiliate.id), eq(commissionsTable.commissionStatus, "pending")));

      return {
        id: affiliate.id,
        userId: affiliate.userId,
        affiliateCode: affiliate.affiliateCode,
        referralSlug: affiliate.referralSlug,
        referralUrl: affiliate.referralUrl,
        defaultCommissionType: affiliate.defaultCommissionType,
        defaultCommissionValue: parseFloat(String(affiliate.defaultCommissionValue)),
        payoutMethod: affiliate.payoutMethod,
        payoutDetails: affiliate.payoutDetails,
        status: affiliate.status,
        createdAt: affiliate.createdAt,
        user: user ? { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status, createdAt: user.createdAt, affiliateId: affiliate.id, affiliateCode: affiliate.affiliateCode } : null,
        totalClicks: Number(clicks?.total ?? 0),
        totalCustomers: Number(customers?.total ?? 0),
        totalRevenue: Number(revenue?.total ?? 0),
        unpaidCommission: Number(unpaid?.total ?? 0),
      };
    }));

    res.json({ data: results, total: totalResult[0]?.count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Get affiliates error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [{ affiliate, user }] = await db.select({ affiliate: affiliatesTable, user: usersTable })
      .from(affiliatesTable).leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(eq(affiliatesTable.id, id)).limit(1);

    if (!affiliate) { res.status(404).json({ error: "Not Found" }); return; }

    const [clicks] = await db.select({ total: count() }).from(referralClicksTable).where(eq(referralClicksTable.affiliateId, id));
    const [customers] = await db.select({ total: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.affiliateId, id));
    const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(gross_amount AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.affiliateId, id));
    const [unpaid] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` }).from(commissionsTable)
      .where(and(eq(commissionsTable.affiliateId, id), eq(commissionsTable.commissionStatus, "pending")));
    const commissionRules = await db.select().from(affiliateCommissionRulesTable).where(eq(affiliateCommissionRulesTable.affiliateId, id));
    const recentPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.affiliateId, id)).orderBy(desc(paymentsTable.paidAt)).limit(10);

    const countryStats = await db.select({ country: referralClicksTable.country, total: count() })
      .from(referralClicksTable).where(and(eq(referralClicksTable.affiliateId, id), isNotNull(referralClicksTable.country)))
      .groupBy(referralClicksTable.country).orderBy(desc(count())).limit(10);
    const totalClicks = Number(clicks?.total ?? 0);
    const totalCustomers = Number(customers?.total ?? 0);

    res.json({
      id: affiliate.id, userId: affiliate.userId, affiliateCode: affiliate.affiliateCode,
      referralSlug: affiliate.referralSlug, referralUrl: affiliate.referralUrl,
      defaultCommissionType: affiliate.defaultCommissionType,
      defaultCommissionValue: parseFloat(String(affiliate.defaultCommissionValue)),
      payoutMethod: affiliate.payoutMethod, payoutDetails: affiliate.payoutDetails,
      status: affiliate.status, createdAt: affiliate.createdAt,
      user: user ? { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status, createdAt: user.createdAt, affiliateId: affiliate.id, affiliateCode: affiliate.affiliateCode } : null,
      totalClicks, totalCustomers,
      totalRevenue: Number(revenue?.total ?? 0),
      unpaidCommission: Number(unpaid?.total ?? 0),
      conversionRate: totalClicks > 0 ? (totalCustomers / totalClicks) * 100 : 0,
      commissionRules: commissionRules.map(r => ({ ...r, commissionValue: parseFloat(String(r.commissionValue)) })),
      recentPayments,
      clicksByCountry: countryStats.map((s, i, arr) => {
        const total = arr.reduce((sum, x) => sum + Number(x.total), 0);
        return { country: s.country ?? "Unknown", count: Number(s.total), percentage: total > 0 ? (Number(s.total) / total) * 100 : 0 };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Get affiliate detail error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/commission", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { defaultCommissionType, defaultCommissionValue } = req.body;

    const old = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, id)).limit(1);
    if (!old[0]) { res.status(404).json({ error: "Not Found" }); return; }

    await db.update(affiliatesTable).set({ defaultCommissionType, defaultCommissionValue: String(defaultCommissionValue) })
      .where(eq(affiliatesTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id, action: "update_commission", targetType: "affiliate", targetId: String(id),
      oldValue: JSON.stringify({ type: old[0].defaultCommissionType, value: old[0].defaultCommissionValue }),
      newValue: JSON.stringify({ type: defaultCommissionType, value: defaultCommissionValue }),
    });

    res.json({ success: true, message: "Commission updated" });
  } catch (err) {
    req.log.error({ err }, "Update commission error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { status, reason } = req.body;

    const old = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, id)).limit(1);
    if (!old[0]) { res.status(404).json({ error: "Not Found" }); return; }

    await db.update(affiliatesTable).set({ status }).where(eq(affiliatesTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id, action: "update_affiliate_status", targetType: "affiliate", targetId: String(id),
      oldValue: old[0].status, newValue: status,
    });

    res.json({ success: true, message: `Affiliate status updated to ${status}` });
  } catch (err) {
    req.log.error({ err }, "Update affiliate status error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/commission-rules", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const rules = await db.select().from(affiliateCommissionRulesTable)
      .where(eq(affiliateCommissionRulesTable.affiliateId, id)).orderBy(desc(affiliateCommissionRulesTable.createdAt));
    res.json(rules.map(r => ({ ...r, commissionValue: parseFloat(String(r.commissionValue)) })));
  } catch (err) {
    req.log.error({ err }, "Get commission rules error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/commission-rules", requireAdmin, async (req, res) => {
  try {
    const affiliateId = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { productId, planId, commissionType, commissionValue, appliesTo, active = true } = req.body;

    const [rule] = await db.insert(affiliateCommissionRulesTable).values({
      affiliateId, productId: productId ?? null, planId: planId ?? null,
      commissionType, commissionValue: String(commissionValue),
      appliesTo: appliesTo ?? "initial_sale", active,
    }).returning();

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "create_commission_rule",
      targetType: "affiliate",
      targetId: String(affiliateId),
      newValue: JSON.stringify({ ruleId: rule.id, commissionType, commissionValue, appliesTo: appliesTo ?? "initial_sale" }),
    });

    res.status(201).json({ ...rule, commissionValue: parseFloat(String(rule.commissionValue)) });
  } catch (err) {
    req.log.error({ err }, "Create commission rule error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /admin/affiliates/:id — permanently removes the affiliate + user account so they can re-register
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const affiliateId = parseInt(req.params.id as string);
    const admin = (req as any).user;

    const aff = await db.select({ affiliate: affiliatesTable, user: usersTable })
      .from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(eq(affiliatesTable.id, affiliateId))
      .limit(1);

    if (!aff[0]) { res.status(404).json({ error: "Affiliate not found" }); return; }

    const { affiliate, user } = aff[0];
    const userId = affiliate.userId;

    // Invalidate sessions & auth tokens
    await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, userId));

    // Delete affiliate-specific data
    await db.delete(affiliateCommissionRulesTable).where(eq(affiliateCommissionRulesTable.affiliateId, affiliateId));
    await db.delete(campaignLinksTable).where(eq(campaignLinksTable.affiliateId, affiliateId));

    // Delete support tickets and their messages for this affiliate
    const tickets = await db.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(eq(supportTicketsTable.affiliateId, affiliateId));
    for (const t of tickets) {
      await db.delete(supportTicketMessagesTable).where(eq(supportTicketMessagesTable.ticketId, t.id));
    }
    await db.delete(supportTicketsTable).where(eq(supportTicketsTable.affiliateId, affiliateId));

    // Delete click tracking, commissions, and payouts (not nullable — must delete)
    await db.delete(referralClicksTable).where(eq(referralClicksTable.affiliateId, affiliateId));
    await db.delete(commissionsTable).where(eq(commissionsTable.affiliateId, affiliateId));
    await db.delete(payoutsTable).where(eq(payoutsTable.affiliateId, affiliateId));

    // Nullify affiliate references on membership + payment records (nullable — preserve for billing history)
    await db.update(whopMembershipsTable).set({ affiliateId: null }).where(eq(whopMembershipsTable.affiliateId, affiliateId));
    await db.update(paymentsTable).set({ affiliateId: null }).where(eq(paymentsTable.affiliateId, affiliateId));

    // Delete the affiliate record, then the user
    await db.delete(affiliatesTable).where(eq(affiliatesTable.id, affiliateId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "delete_affiliate",
      targetType: "affiliate",
      targetId: String(affiliateId),
      oldValue: JSON.stringify({ email: user?.email, affiliateCode: affiliate.affiliateCode }),
      newValue: JSON.stringify({ deleted: true, reason: "Admin deleted — re-registration allowed" }),
    });

    res.json({ success: true, message: `Affiliate ${user?.email ?? affiliateId} deleted. They can now re-register with the same email.` });
  } catch (err) {
    req.log.error({ err }, "Delete affiliate error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

// POST /admin/affiliates/:id/reset-password
// Admin resets an affiliate's login password and returns the new temp password.
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const affiliateId = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { newPassword } = req.body ?? {};

    const affiliate = await db.select({ userId: affiliatesTable.userId })
      .from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId)).limit(1);
    if (!affiliate[0]) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    const password = newPassword ?? (Math.random().toString(36).slice(-8) + "A1!");
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(usersTable.id, affiliate[0].userId));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "reset_affiliate_password",
      targetType: "affiliate",
      targetId: String(affiliateId),
      newValue: JSON.stringify({ note: "Password was reset by admin" }),
    });

    res.json({ success: true, newPassword: password });
  } catch (err) {
    req.log.error({ err }, "Reset affiliate password error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

