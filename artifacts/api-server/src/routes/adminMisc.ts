import { Router, type IRouter } from "express";
import { db, adminAuditLogsTable, emailLogsTable, usersTable, affiliateCommissionRulesTable, affiliatesTable, whopMembershipsTable, whopCustomersTable, paymentsTable, commissionsTable, referralClicksTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { syncMemberships, syncPayments, backfillMembershipPayments, getWhopPlatformStats, whopFetch } from "../lib/whop";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

router.get("/audit-logs", requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const logs = await db.select({ log: adminAuditLogsTable, email: usersTable.email })
      .from(adminAuditLogsTable)
      .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
      .orderBy(desc(adminAuditLogsTable.createdAt)).limit(limitNum).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(adminAuditLogsTable);

    res.json({
      data: logs.map(({ log, email }) => ({ ...log, adminEmail: email ?? null })),
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Get audit logs error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/email-logs", requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "100" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const logs = await db.select().from(emailLogsTable)
      .orderBy(desc(emailLogsTable.createdAt)).limit(limitNum).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(emailLogsTable);

    res.json({
      data: logs,
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Get email logs error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/sync/whop/memberships", requireAdmin, async (req, res) => {
  try {
    const result = await syncMemberships();
    res.json({ ...result, message: `Synced ${result.synced} memberships: ${result.created} created, ${result.updated} updated, ${result.errors} errors` });
  } catch (err) {
    req.log.error({ err }, "Sync memberships error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

router.post("/sync/whop/payments", requireAdmin, async (req, res) => {
  try {
    const result = await syncPayments();
    res.json({ ...result, message: `Synced ${result.synced} payments: ${result.created} created, ${result.updated} updated, ${result.errors} errors` });
  } catch (err) {
    req.log.error({ err }, "Sync payments error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

router.get("/whop/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await getWhopPlatformStats();
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Whop stats error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/whop/customers", requireAdmin, async (req, res) => {
  const key = process.env.WHOP_API_KEY;
  if (!key) { res.status(500).json({ error: "WHOP_API_KEY not configured" }); return; }

  const v2Headers = { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
  const v2 = (path: string): Promise<any> =>
    fetch(`https://api.whop.com/api/v2${path}`, { headers: v2Headers }).then(r => r.json());

  try {
    // 1. Fetch all plans, memberships, payments, affiliates, and local attribution in parallel
    const [plansRes, firstMemPage, firstPayPage, affiliateRows, localAttributions] = await Promise.all([
      v2("/plans?per=50&page=1"),
      v2("/memberships?per=50&page=1"),
      v2("/payments?per=50&page=1").catch(() => null),
      db.select({ email: usersTable.email, affiliateCode: affiliatesTable.affiliateCode, affiliateStatus: affiliatesTable.status })
        .from(affiliatesTable)
        .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id)),
      // Pull local membership attribution (manually assigned affiliates)
      db.select({
        whopMembershipId: whopMembershipsTable.whopMembershipId,
        affiliateId: whopMembershipsTable.affiliateId,
        affiliateCode: affiliatesTable.affiliateCode,
        affiliateName: usersTable.fullName,
      })
        .from(whopMembershipsTable)
        .innerJoin(affiliatesTable, eq(whopMembershipsTable.affiliateId, affiliatesTable.id))
        .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id)),
    ]);

    // Build local attribution map: whopMembershipId -> affiliate info
    const localAttrMap: Record<string, { affiliateId: number; affiliateCode: string; affiliateName: string }> = {};
    for (const la of localAttributions) {
      if (la.whopMembershipId) {
        localAttrMap[la.whopMembershipId] = {
          affiliateId: la.affiliateId!,
          affiliateCode: la.affiliateCode ?? "",
          affiliateName: la.affiliateName ?? la.affiliateCode ?? "",
        };
      }
    }

    // Build affiliate email set (approved affiliates)
    const affiliateEmailMap: Record<string, { code: string; status: string }> = {};
    for (const a of affiliateRows) {
      if (a.email) affiliateEmailMap[a.email.toLowerCase()] = { code: a.affiliateCode ?? "", status: a.affiliateStatus ?? "" };
    }

    // Build plan price map — paginate through all plan pages
    const totalPlanPages: number = plansRes?.pagination?.total_page ?? 1;
    const allPlans: any[] = [...(plansRes?.data ?? [])];
    if (totalPlanPages > 1) {
      const extraPlanPages = await Promise.all(
        Array.from({ length: totalPlanPages - 1 }, (_, i) => v2(`/plans?per=50&page=${i + 2}`).catch(() => null))
      );
      for (const r of extraPlanPages) if (r?.data) allPlans.push(...r.data);
    }

    const planMap: Record<string, { price: number; label: string }> = {};
    for (const plan of allPlans) {
      // Whop v2 can use various price fields — try all of them
      const rawPrice = plan.initial_price ?? plan.renewal_price ?? plan.base_currency_price ?? plan.price ?? "0";
      const price = parseFloat(String(rawPrice));
      const planName: string | null = plan.internal_notes ?? plan.metadata?.name ?? null;
      const label = price > 0
        ? planName ? `${planName} — $${price % 1 === 0 ? price : price.toFixed(2)}` : `$${price % 1 === 0 ? price : price.toFixed(2)}`
        : "Free";
      planMap[plan.id] = { price, label };
    }

    // Fetch remaining membership pages
    const totalMemPages: number = firstMemPage?.pagination?.total_page ?? 1;
    const allMems: any[] = [...(firstMemPage?.data ?? [])];
    if (totalMemPages > 1) {
      const extras = await Promise.all(
        Array.from({ length: totalMemPages - 1 }, (_, i) => v2(`/memberships?per=50&page=${i + 2}`).catch(() => null))
      );
      for (const r of extras) if (r?.data) allMems.push(...r.data);
    }

    // Fetch remaining payment pages and build membershipId → billing name map
    const totalPayPages = Math.min(firstPayPage?.pagination?.total_page ?? 1, 20);
    const payPages: any[][] = [firstPayPage?.data ?? []];
    if (totalPayPages > 1) {
      const extraPays = await Promise.all(
        Array.from({ length: totalPayPages - 1 }, (_, i) => v2(`/payments?per=50&page=${i + 2}`).catch(() => null))
      );
      for (const r of extraPays) payPages.push(r?.data ?? []);
    }
    const nameMap: Record<string, string> = {};
    for (const page of payPages) {
      for (const pay of page) {
        const memId = pay.membership;
        if (memId && !nameMap[memId]) {
          const fn = pay.billing_first_name ?? "";
          const ln = pay.billing_last_name ?? "";
          const fullName = `${fn} ${ln}`.trim();
          if (fullName) nameMap[memId] = fullName;
        }
      }
    }

    // Build membership → actual payment amount map from payments pages
    const paymentAmountMap: Record<string, number> = {};
    for (const page of payPages) {
      for (const pay of page) {
        const memId = pay.membership;
        if (memId && !paymentAmountMap[memId]) {
          const amt = pay.final_amount ?? pay.subtotal ?? pay.amount ?? 0;
          if (amt > 0) paymentAmountMap[memId] = amt;
        }
      }
    }

    // Combine all data
    const customers = allMems.map(m => {
      const planFallback = planMap[m.plan] ?? { price: 0, label: "Unknown" };
      // Prefer actual payment amount over plan price — more accurate
      const paidAmount = paymentAmountMap[m.id] ?? 0;
      const packagePrice = paidAmount > 0 ? paidAmount : planFallback.price;
      const packageLabel = packagePrice > 0
        ? `$${packagePrice % 1 === 0 ? packagePrice : packagePrice.toFixed(2)}`
        : planFallback.label === "Unknown" ? "Free" : planFallback.label;

      const name = nameMap[m.id] ?? m.email?.split("@")[0] ?? "—";
      const email = (m.email ?? "").toLowerCase();
      const affiliateInfo = affiliateEmailMap[email] ?? null;
      const localAttr = localAttrMap[m.id] ?? null;
      return {
        id: m.id,
        name,
        email: m.email ?? "—",
        package: packageLabel,
        packagePrice,
        status: m.valid ? "active" : "inactive",
        whopStatus: m.status,
        joinedAt: m.created_at ? new Date(m.created_at * 1000).toISOString() : null,
        planId: m.plan,
        isAffiliate: !!affiliateInfo,
        affiliateCode: affiliateInfo?.code ?? null,
        affiliateStatus: affiliateInfo?.status ?? null,
        // Referral attribution (which affiliate referred this customer)
        referredById: localAttr?.affiliateId ?? null,
        referredByCode: localAttr?.affiliateCode ?? null,
        referredByName: localAttr?.affiliateName ?? null,
      };
    });

    // Sort: active first, then newest first
    customers.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "");
    });

    res.json({ customers, total: customers.length });
  } catch (err: any) {
    req.log.error({ err }, "Whop customers error");
    res.status(500).json({ error: "Internal Server Error", message: String(err?.message ?? err) });
  }
});


// DELETE /admin/whop/customers/:membershipId — removes membership (and customer if no others) from local DB
router.delete("/whop/customers/:membershipId", requireAdmin, async (req, res) => {
  try {
    const membershipId = req.params.membershipId as string;
    const admin = (req as any).user;

    // Find the membership in our local DB
    const membership = await db.select().from(whopMembershipsTable).where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1);

    let deletedEmail = membershipId;
    if (membership[0]) {
      const whopUserId = membership[0].whopUserId;

      // Find the customer record for logging
      const customer = await db.select().from(whopCustomersTable).where(eq(whopCustomersTable.whopUserId, whopUserId ?? "")).limit(1);
      deletedEmail = customer[0]?.email ?? membershipId;

      // Delete the membership
      await db.delete(whopMembershipsTable).where(eq(whopMembershipsTable.whopMembershipId, membershipId));

      // If customer has no remaining memberships, delete the customer record too
      if (whopUserId) {
        const remaining = await db.select({ count: count() }).from(whopMembershipsTable).where(eq(whopMembershipsTable.whopUserId, whopUserId));
        if (Number(remaining[0]?.count ?? 0) === 0) {
          await db.delete(whopCustomersTable).where(eq(whopCustomersTable.whopUserId, whopUserId));
        }
      }

      await db.insert(adminAuditLogsTable).values({
        adminUserId: admin.id,
        action: "delete_customer",
        targetType: "whop_membership",
        targetId: membershipId,
        oldValue: JSON.stringify({ email: deletedEmail, whopUserId }),
        newValue: JSON.stringify({ deleted: true }),
      });
    }

    res.json({ success: true, message: `Customer record for ${deletedEmail} removed from local database.` });
  } catch (err) {
    req.log.error({ err }, "Delete customer error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

// POST /admin/whop/customers/:membershipId/assign-affiliate
// Manually attribute a customer to an affiliate so the affiliate gets commission credit.
router.post("/whop/customers/:membershipId/assign-affiliate", requireAdmin, async (req, res) => {
  try {
    const membershipId = req.params.membershipId as string;
    const { affiliateId } = req.body as { affiliateId: number };
    const admin = (req as any).user;

    if (!affiliateId) { res.status(400).json({ error: "affiliateId is required" }); return; }

    // Validate affiliate exists and get commission info
    const [affiliate] = await db.select({
      id: affiliatesTable.id,
      code: affiliatesTable.affiliateCode,
      commissionValue: affiliatesTable.defaultCommissionValue,
      commissionType: affiliatesTable.defaultCommissionType,
      name: usersTable.fullName,
    })
      .from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(eq(affiliatesTable.id, affiliateId))
      .limit(1);

    if (!affiliate) { res.status(404).json({ error: "Affiliate not found" }); return; }

    // Find or create local membership record
    const existing = await db.select().from(whopMembershipsTable)
      .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1);

    if (existing.length === 0) {
      // Membership not in local DB yet — create a minimal record
      await db.insert(whopMembershipsTable).values({
        whopMembershipId: membershipId,
        affiliateId,
        status: "active",
        startDate: new Date(),
        createdAt: new Date(),
      });
    } else {
      // Update existing record
      await db.update(whopMembershipsTable)
        .set({ affiliateId, updatedAt: new Date() })
        .where(eq(whopMembershipsTable.whopMembershipId, membershipId));
    }

    // Also attribute any existing payments for this membership that have no affiliate
    const unattributedPayments = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.whopMembershipId, membershipId)));

    let commissionsCreated = 0;
    for (const payment of unattributedPayments) {
      // Update payment to credit this affiliate (only if unattributed)
      if (!payment.affiliateId) {
        await db.update(paymentsTable)
          .set({ affiliateId })
          .where(eq(paymentsTable.id, payment.id));
      }

      // Create commission if not already existing for this payment
      const existingCommission = await db.select().from(commissionsTable)
        .where(and(eq(commissionsTable.paymentId, payment.id), eq(commissionsTable.affiliateId, affiliateId)))
        .limit(1);

      if (existingCommission.length === 0) {
        const amount = parseFloat(payment.grossAmount ?? "0");
        const rate = parseFloat(String(affiliate.commissionValue ?? "25"));
        const commAmount = (amount * rate) / 100;
        if (amount > 0) {
          await db.insert(commissionsTable).values({
            affiliateId,
            paymentId: payment.id,
            commissionType: affiliate.commissionType ?? "percent",
            commissionValue: String(rate),
            commissionAmount: String(commAmount),
            commissionStatus: "pending",
            reason: `Manually attributed by admin — membership ${membershipId}`,
          });
          commissionsCreated++;
        }
      }
    }

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "assign_affiliate",
      targetType: "whop_membership",
      targetId: membershipId,
      oldValue: JSON.stringify({ affiliateId: existing[0]?.affiliateId ?? null }),
      newValue: JSON.stringify({ affiliateId, affiliateCode: affiliate.code, commissionsCreated }),
    });

    res.json({
      success: true,
      affiliateId,
      affiliateCode: affiliate.code,
      affiliateName: affiliate.name,
      commissionsCreated,
      message: `Attribution set to ${affiliate.name ?? affiliate.code}. ${commissionsCreated} commission record(s) created.`,
    });
  } catch (err) {
    req.log.error({ err }, "Assign affiliate error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

router.post("/backfill/membership-payments", requireAdmin, async (req, res) => {
  try {
    const result = await backfillMembershipPayments();
    res.json({ ...result, message: `Processed ${result.processed} memberships: ${result.created} payments created, ${result.skipped} skipped, ${result.errors} errors` });
  } catch (err) {
    req.log.error({ err }, "Backfill membership payments error");
    res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
});

// POST /admin/sync/whop/full
// Full historical backfill from Whop v2 API:
// - Syncs all memberships + attributes to affiliates via affiliate_username
// - Syncs all payments + creates commissions
// - Creates backdated referral clicks for attributed memberships
router.post("/sync/whop/full", requireAdmin, async (req, res) => {
  const key = process.env.WHOP_API_KEY;
  if (!key) { res.status(500).json({ error: "WHOP_API_KEY not configured" }); return; }

  const v2 = (path: string): Promise<any> =>
    fetch(`https://api.whop.com/api/v2${path}`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    }).then(r => r.json());

  const stats = { memberships: 0, membershipsAttributed: 0, payments: 0, commissions: 0, clicks: 0, errors: 0 };

  try {
    // 1. Build affiliate code → affiliateId map
    const allAffiliates = await db.select({
      id: affiliatesTable.id,
      code: affiliatesTable.affiliateCode,
      commissionValue: affiliatesTable.defaultCommissionValue,
      commissionType: affiliatesTable.defaultCommissionType,
    }).from(affiliatesTable);

    const codeMap: Record<string, typeof allAffiliates[0]> = {};
    for (const a of allAffiliates) {
      if (a.code) codeMap[a.code.toLowerCase()] = a;
    }

    // 2. Fetch ALL memberships from v2 across every status (active, expired, canceled, trialing, completed)
    // Whop v2 default only returns active — must query each status separately
    const allMems: any[] = [];
    const memStatuses = ["active", "expired", "canceled", "trialing", "completed"];
    for (const memStatus of memStatuses) {
      const firstPage = await v2(`/memberships?per=50&page=1&status=${memStatus}`).catch(() => null);
      if (!firstPage?.data) continue;
      allMems.push(...firstPage.data);
      const totalPages: number = firstPage?.pagination?.total_page ?? 1;
      if (totalPages > 1) {
        const extras = await Promise.all(
          Array.from({ length: Math.min(totalPages - 1, 40) }, (_, i) =>
            v2(`/memberships?per=50&page=${i + 2}&status=${memStatus}`).catch(() => null)
          )
        );
        for (const r of extras) if (r?.data) allMems.push(...r.data);
      }
    }
    // Deduplicate by membership id in case Whop returns some in multiple status buckets
    const seenMemIds = new Set<string>();
    const uniqueMems = allMems.filter(m => {
      if (seenMemIds.has(m.id)) return false;
      seenMemIds.add(m.id);
      return true;
    });

    // 3. Sync each membership
    for (const m of uniqueMems) {
      try {
        // Determine affiliate attribution from affiliate_username field
        const affCode = (m.affiliate_username ?? "").toLowerCase();
        const affiliate = affCode ? codeMap[affCode] ?? null : null;
        const affiliateId = affiliate?.id ?? null;

        // Upsert customer
        if (m.user_id && m.email) {
          const existing = await db.select().from(whopCustomersTable)
            .where(eq(whopCustomersTable.whopUserId, m.user_id)).limit(1);
          if (existing.length === 0) {
            await db.insert(whopCustomersTable).values({
              whopUserId: m.user_id, email: m.email ?? null,
              fullName: m.user?.name ?? m.username ?? null, country: m.user?.country ?? null,
            }).catch(() => {});
          }
        }

        // Upsert membership
        const joinDate = m.created_at ? new Date(m.created_at * 1000) : new Date();
        const existing = await db.select().from(whopMembershipsTable)
          .where(eq(whopMembershipsTable.whopMembershipId, m.id)).limit(1);

        if (existing.length === 0) {
          await db.insert(whopMembershipsTable).values({
            whopMembershipId: m.id,
            whopUserId: m.user_id ?? null,
            whopProductId: m.product ?? m.product_id ?? null,
            whopPlanId: m.plan ?? m.plan_id ?? null,
            affiliateId,
            status: m.status ?? "active",
            startDate: joinDate,
            createdAt: joinDate,
          });
        } else if (affiliateId && !existing[0].affiliateId) {
          await db.update(whopMembershipsTable)
            .set({ affiliateId, updatedAt: new Date() })
            .where(eq(whopMembershipsTable.whopMembershipId, m.id));
        }

        stats.memberships++;
        if (affiliateId) {
          stats.membershipsAttributed++;

          // Create a backdated referral click if none exists
          const clickExists = await db.select().from(referralClicksTable)
            .where(and(
              eq(referralClicksTable.affiliateId, affiliateId),
              eq(referralClicksTable.referralCode, affiliate?.code ?? "")
            )).limit(1);

          // Only create one synthetic click per membership (avoid duplication)
          const syntheticSession = `backfill_${m.id}`;
          const clickWithSession = await db.select().from(referralClicksTable)
            .where(eq(referralClicksTable.sessionId, syntheticSession)).limit(1);

          if (clickWithSession.length === 0) {
            await db.insert(referralClicksTable).values({
              affiliateId,
              referralCode: affiliate?.code ?? "",
              ipHash: `backfill_${m.user_id ?? m.id}`,
              country: m.user?.country ?? null,
              utmSource: "whop",
              utmMedium: "referral",
              sessionId: syntheticSession,
              clickedAt: joinDate,
            });
            stats.clicks++;
          }
        }
      } catch (err) {
        stats.errors++;
      }
    }

    // 4. Fetch all payments from v2 (paginated, up to 40 pages)
    const firstPayPage = await v2("/payments?per=50&page=1");
    const totalPayPages: number = Math.min(firstPayPage?.pagination?.total_page ?? 1, 40);
    const allPays: any[] = [...(firstPayPage?.data ?? [])];
    if (totalPayPages > 1) {
      const extras = await Promise.all(
        Array.from({ length: totalPayPages - 1 }, (_, i) =>
          v2(`/payments?per=50&page=${i + 2}`).catch(() => null)
        )
      );
      for (const r of extras) if (r?.data) allPays.push(...r.data);
    }

    // 5. Sync each payment
    for (const p of allPays) {
      try {
        const status = (p.status ?? "").toLowerCase();
        if (status && status !== "paid" && status !== "complete" && status !== "completed" && status !== "succeeded") continue;

        const existing = await db.select().from(paymentsTable)
          .where(eq(paymentsTable.whopPaymentId, p.id)).limit(1);
        if (existing.length > 0) continue;

        const membershipId = p.membership ?? p.membership_id ?? null;
        const membership = membershipId
          ? await db.select().from(whopMembershipsTable)
              .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1)
          : [];
        const affiliateId = membership[0]?.affiliateId ?? null;
        const amount = p.final_amount ?? p.subtotal ?? p.amount ?? 0;

        const [payment] = await db.insert(paymentsTable).values({
          whopPaymentId: p.id,
          whopMembershipId: membershipId,
          affiliateId,
          grossAmount: String(amount),
          netAmount: String(amount),
          currency: p.currency ?? "USD",
          paymentType: p.renewal ? "renewal" : "initial",
          paidAt: p.paid_at ? new Date(p.paid_at * 1000) : new Date(),
          status: "paid",
          rawPayload: JSON.stringify(p),
        }).returning();

        stats.payments++;

        // Create commission if attributed
        if (affiliateId && amount > 0) {
          const affiliate = allAffiliates.find(a => a.id === affiliateId);
          const rate = Number(affiliate?.commissionValue ?? 25);
          const commAmount = (amount * rate) / 100;
          await db.insert(commissionsTable).values({
            affiliateId,
            paymentId: payment.id,
            commissionType: affiliate?.commissionType ?? "percent",
            commissionValue: String(rate),
            commissionAmount: String(commAmount),
            commissionStatus: "pending",
            reason: `Historical sync — ${p.id}`,
          }).catch(() => {});
          stats.commissions++;
        }
      } catch (err) {
        stats.errors++;
      }
    }

    res.json({
      success: true,
      message: `Full sync complete: ${stats.memberships} memberships (${stats.membershipsAttributed} attributed), ${stats.payments} payments, ${stats.commissions} commissions, ${stats.clicks} referral clicks created, ${stats.errors} errors`,
      ...stats,
    });
  } catch (err: any) {
    req.log.error({ err }, "Full Whop sync error");
    res.status(500).json({ error: "Internal Server Error", message: String(err?.message ?? err) });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { role, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const users = await db.select().from(usersTable)
      .where(role ? eq(usersTable.role, role as any) : undefined)
      .orderBy(desc(usersTable.createdAt)).limit(limitNum).offset(offset);
    const [totalResult] = await db.select({ count: count() }).from(usersTable)
      .where(role ? eq(usersTable.role, role as any) : undefined);

    res.json({
      data: users.map(u => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role, status: u.status, createdAt: u.createdAt, affiliateId: null, affiliateCode: null })),
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Get users error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ error: "Bad Request", message: "All fields required" }); return;
    }
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(), passwordHash: hashPassword(password), fullName, role, status: "active",
    }).returning();
    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status, createdAt: user.createdAt, affiliateId: null, affiliateCode: null });
  } catch (err) {
    req.log.error({ err }, "Create user error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/commission-rules/:ruleId", requireAdmin, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.ruleId as string);
    const { commissionType, commissionValue, appliesTo, active, productId, planId } = req.body;
    const [rule] = await db.update(affiliateCommissionRulesTable).set({
      commissionType, commissionValue: String(commissionValue), appliesTo, active,
      productId: productId ?? null, planId: planId ?? null, updatedAt: new Date(),
    }).where(eq(affiliateCommissionRulesTable.id, ruleId)).returning();
    res.json({ ...rule, commissionValue: parseFloat(String(rule.commissionValue)) });
  } catch (err) {
    req.log.error({ err }, "Update commission rule error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/commission-rules/:ruleId", requireAdmin, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.ruleId as string);
    await db.delete(affiliateCommissionRulesTable).where(eq(affiliateCommissionRulesTable.id, ruleId));
    res.json({ success: true, message: "Commission rule deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete commission rule error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── CSV Exports ──────────────────────────────────────────────────────────────

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

router.get("/export/customers", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select({
      membership: whopMembershipsTable,
      customer: whopCustomersTable,
    }).from(whopMembershipsTable)
      .leftJoin(whopCustomersTable, eq(whopMembershipsTable.whopUserId, whopCustomersTable.whopUserId))
      .orderBy(desc(whopMembershipsTable.createdAt));

    const csv = toCSV(rows.map(({ membership, customer }) => ({
      whop_membership_id: membership.whopMembershipId ?? '',
      name: customer?.fullName ?? '',
      email: customer?.email ?? '',
      status: membership.status ?? '',
      plan_id: membership.whopPlanId ?? '',
      start_date: membership.startDate ?? '',
      renewal_date: membership.renewalDate ?? '',
      canceled_at: membership.canceledAt ?? '',
      country: customer?.country ?? '',
      joined_at: membership.createdAt?.toISOString() ?? '',
    })));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export customers error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export/affiliates", requireAdmin, async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    const rows = await db.select({
      affiliate: affiliatesTable,
      user: usersTable,
      totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(gross_amount AS NUMERIC)) FROM payments WHERE affiliate_id = ${affiliatesTable.id}), 0)`,
      unpaidComm: sql<number>`COALESCE((SELECT SUM(CAST(commission_amount AS NUMERIC)) FROM commissions WHERE affiliate_id = ${affiliatesTable.id} AND commission_status = 'pending'), 0)`,
    }).from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(affiliatesTable.createdAt));

    const csv = toCSV(rows.map(({ affiliate, user, totalRevenue, unpaidComm }) => ({
      id: affiliate.id,
      name: user?.fullName ?? '',
      email: user?.email ?? '',
      affiliate_code: affiliate.affiliateCode ?? '',
      status: affiliate.status ?? '',
      commission_type: affiliate.defaultCommissionType ?? '',
      commission_value: affiliate.defaultCommissionValue ?? '',
      payout_method: affiliate.payoutMethod ?? '',
      payout_details: affiliate.payoutDetails ?? '',
      total_revenue: Number(totalRevenue).toFixed(2),
      unpaid_commission: Number(unpaidComm).toFixed(2),
      joined_at: affiliate.createdAt?.toISOString() ?? '',
    })));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="affiliates.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export affiliates error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export/commissions", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select({
      commission: commissionsTable,
      user: usersTable,
    }).from(commissionsTable)
      .leftJoin(affiliatesTable, eq(commissionsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(commissionsTable.createdAt));

    const csv = toCSV(rows.map(({ commission, user }) => ({
      id: commission.id,
      affiliate_name: user?.fullName ?? '',
      affiliate_email: user?.email ?? '',
      commission_amount: Number(commission.commissionAmount ?? 0).toFixed(2),
      commission_type: commission.commissionType ?? '',
      commission_value: commission.commissionValue ?? '',
      status: commission.commissionStatus ?? '',
      reason: commission.reason ?? '',
      payment_id: commission.paymentId ?? '',
      created_at: commission.createdAt?.toISOString() ?? '',
    })));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="commissions.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export commissions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export/payments", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(paymentsTable)
      .orderBy(desc(paymentsTable.paidAt));

    const csv = toCSV(rows.map(p => ({
      id: p.id,
      whop_payment_id: p.whopPaymentId ?? '',
      whop_membership_id: p.whopMembershipId ?? '',
      payment_type: p.paymentType ?? '',
      gross_amount: Number(p.grossAmount ?? 0).toFixed(2),
      net_amount: Number(p.netAmount ?? 0).toFixed(2),
      status: p.status ?? '',
      affiliate_id: p.affiliateId ?? '',
      paid_at: p.paidAt?.toISOString() ?? '',
    })));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export payments error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
