import { db, whopCustomersTable, whopMembershipsTable, paymentsTable, affiliatesTable, referralSessionsTable, commissionsTable, referralClicksTable } from "@workspace/db";
import { eq, and, isNotNull, gte, desc } from "drizzle-orm";
import { logger } from "./logger";

const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_API_BASE = "https://api.whop.com/api/v5";

export async function whopFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!WHOP_API_KEY) throw new Error("WHOP_API_KEY not configured");
  const res = await fetch(`${WHOP_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${WHOP_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whop API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Whop v2 fetch — for endpoints not available in v5
async function whopFetchV2(path: string): Promise<any> {
  if (!WHOP_API_KEY) throw new Error("WHOP_API_KEY not configured");
  const res = await fetch(`https://api.whop.com/api/v2${path}`, {
    headers: { Authorization: `Bearer ${WHOP_API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whop v2 API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getWhopPlatformStats(): Promise<{
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  totalSales: number;
  mrr: number;
  error?: string;
}> {
  try {
    // v5 /company/memberships returns total_count and total_pages in pagination
    const [allRes, activeRes] = await Promise.all([
      whopFetch("/company/memberships?per=1&page=1").catch(() => null),
      whopFetch("/company/memberships?status=active&per=1&page=1").catch(() => null),
    ]);

    const totalMembers: number = allRes?.pagination?.total_count ?? 0;
    const activeMembers: number = activeRes?.pagination?.total_count ?? 0;

    // v2 /payments: paginate all pages to sum revenue
    let totalRevenue = 0;
    let totalSales = 0;
    try {
      const firstPage = await whopFetchV2("/payments?per=50&page=1");
      const totalPages: number = firstPage?.pagination?.total_page ?? 1;

      const processPage = (payments: any[]) => {
        for (const p of payments) {
          // Only count completed/paid payments — exclude refunded, failed, pending
          const status = (p.status ?? "").toLowerCase();
          if (status && status !== "paid" && status !== "complete" && status !== "completed" && status !== "succeeded") continue;
          // v2 payment amounts are already in DOLLARS (e.g. 9.98 = $9.98)
          const amount = p.final_amount ?? p.subtotal ?? 0;
          if (amount > 0) { totalRevenue += amount; totalSales++; }
        }
      };

      processPage(firstPage?.data ?? []);

      // Fetch remaining pages in parallel (up to 20 pages max = 1000 payments)
      const pagesToFetch = Math.min(totalPages, 20);
      if (pagesToFetch > 1) {
        const pageNums = Array.from({ length: pagesToFetch - 1 }, (_, i) => i + 2);
        const pageResults = await Promise.all(
          pageNums.map(p => whopFetchV2(`/payments?per=50&page=${p}`).catch(() => null))
        );
        for (const result of pageResults) {
          if (result?.data) processPage(result.data);
        }
      }
    } catch (err) {
      logger.warn({ err }, "getWhopPlatformStats: could not fetch payments");
    }

    // MRR: sum recurring plan prices × active member count per plan
    let mrr = 0;
    try {
      // Fetch all plans to find recurring ones
      const plansRes = await whopFetchV2("/plans?per=50&page=1").catch(() => null);
      const plans: any[] = plansRes?.data ?? [];
      // Build map of planId → monthly renewal price (dollars)
      const planPriceMap: Record<string, number> = {};
      for (const plan of plans) {
        // Only count genuinely recurring subscription plans
        const planType = (plan.plan_type ?? "").toLowerCase();
        const isRecurring = planType === "recurring" || planType === "subscription";
        if (!isRecurring) continue;
        const price = parseFloat(plan.renewal_price ?? plan.initial_price ?? "0");
        if (price > 0) planPriceMap[plan.id] = price;
      }
      if (Object.keys(planPriceMap).length > 0) {
        // Count active memberships per recurring plan
        const activeFirst = await whopFetchV2("/memberships?per=50&page=1&status=active").catch(() => null);
        const activePages = Math.min(activeFirst?.pagination?.total_page ?? 1, 5);
        const activeMems: any[] = [...(activeFirst?.data ?? [])];
        if (activePages > 1) {
          const extras = await Promise.all(
            Array.from({ length: activePages - 1 }, (_, i) =>
              whopFetchV2(`/memberships?per=50&page=${i + 2}&status=active`).catch(() => null)
            )
          );
          for (const r of extras) if (r?.data) activeMems.push(...r.data);
        }
        for (const m of activeMems) {
          const planPrice = planPriceMap[m.plan] ?? 0;
          mrr += planPrice;
        }
      }
    } catch (err) {
      logger.warn({ err }, "getWhopPlatformStats: could not compute MRR");
    }

    return { totalMembers, activeMembers, totalRevenue, totalSales, mrr };
  } catch (err: any) {
    logger.error({ err }, "getWhopPlatformStats error");
    return { totalMembers: 0, activeMembers: 0, totalRevenue: 0, totalSales: 0, mrr: 0, error: String(err?.message ?? err) };
  }
}

export async function syncMemberships(): Promise<{ synced: number; created: number; updated: number; errors: number }> {
  let synced = 0, created = 0, updated = 0, errors = 0;

  const endpoints = ["/memberships?page=1&per=50"];
  let memberships: any[] = [];
  for (const endpoint of endpoints) {
    try {
      const data = await whopFetch(endpoint);
      memberships = data.data ?? [];
      logger.info({ endpoint, count: memberships.length }, "Fetched memberships from Whop");
      break;
    } catch (err: any) {
      if (err?.message?.includes("404")) {
        logger.warn({ endpoint }, "Whop memberships endpoint 404 — no results");
        break; // Return empty, not an error
      }
      logger.error({ err }, "Error fetching memberships from Whop");
      errors++;
      return { synced, created, updated, errors };
    }
  }

  try {
    for (const m of memberships) {
      synced++;
      try {
        const existing = await db.select().from(whopMembershipsTable)
          .where(eq(whopMembershipsTable.whopMembershipId, m.id)).limit(1);

        const record = {
          whopMembershipId: m.id,
          whopUserId: m.user_id ?? m.discord_account_id ?? null,
          whopProductId: m.product_id ?? null,
          whopPlanId: m.plan_id ?? null,
          status: m.status ?? "active",
          startDate: m.created_at ? new Date(m.created_at * 1000) : null,
          renewalDate: m.renewal_period_start ? new Date(m.renewal_period_start * 1000) : null,
          canceledAt: m.canceled_at ? new Date(m.canceled_at * 1000) : null,
          updatedAt: new Date(),
        };

        if (existing.length === 0) {
          await db.insert(whopMembershipsTable).values({ ...record, createdAt: new Date() });
          created++;
        } else {
          await db.update(whopMembershipsTable).set(record)
            .where(eq(whopMembershipsTable.whopMembershipId, m.id));
          updated++;
        }

        if (m.user_id) {
          await upsertCustomer(m.user_id, m.user?.email ?? null, m.user?.name ?? null, m.user?.country ?? null);
        }
      } catch (err) {
        errors++;
        logger.error({ err, membershipId: m.id }, "Error syncing membership");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error processing memberships sync");
    errors++;
  }
  return { synced, created, updated, errors };
}

export async function syncPayments(): Promise<{ synced: number; created: number; updated: number; errors: number }> {
  let synced = 0, created = 0, updated = 0, errors = 0;

  // Whop v5 uses /invoices (not /payments which was a v4 endpoint)
  const endpoints = ["/invoices?page=1&per=50", "/payments?page=1&per=50"];
  let invoices: any[] = [];

  for (const endpoint of endpoints) {
    try {
      const data = await whopFetch(endpoint);
      invoices = data.data ?? [];
      logger.info({ endpoint, count: invoices.length }, "Fetched invoices from Whop");
      break;
    } catch (err: any) {
      if (err?.message?.includes("404")) {
        logger.warn({ endpoint }, "Whop endpoint 404 — trying next");
        continue;
      }
      logger.error({ err }, "Error fetching invoices from Whop");
      errors++;
      return { synced, created, updated, errors };
    }
  }

  for (const p of invoices) {
    synced++;
    try {
      const paymentId = p.id;
      const existing = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.whopPaymentId, paymentId)).limit(1);
      if (existing.length > 0) {
        await db.update(paymentsTable).set({ status: p.status })
          .where(eq(paymentsTable.whopPaymentId, paymentId));
        updated++;
      } else {
        const membershipId = p.membership_id ?? p.memberships?.[0]?.id ?? null;
        const membership = membershipId ? await db.select().from(whopMembershipsTable)
          .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1) : [];
        const affiliateId = membership[0]?.affiliateId ?? null;
        const amount = p.final_amount ?? p.amount ?? p.total ?? 0;
        const amountDollars = amount > 1000 ? amount / 100 : amount; // normalize from cents if needed

        await db.insert(paymentsTable).values({
          whopPaymentId: paymentId,
          whopMembershipId: membershipId,
          affiliateId,
          grossAmount: String(amountDollars),
          netAmount: String(amountDollars),
          currency: p.currency ?? "USD",
          paymentType: p.renewal ? "renewal" : "initial",
          paidAt: p.paid_at ? new Date(p.paid_at * 1000) : p.created_at ? new Date(p.created_at * 1000) : new Date(),
          status: p.status ?? "paid",
          rawPayload: JSON.stringify(p),
        });
        created++;

        if (affiliateId && (p.status === "paid" || !p.status)) {
          await createCommissionForPayment(affiliateId, null, paymentId, amountDollars, p.renewal ? "renewal" : "initial");
        }
      }
    } catch (err) {
      errors++;
      logger.error({ err, paymentId: p.id }, "Error syncing payment");
    }
  }
  return { synced, created, updated, errors };
}

// Backfill payments for existing memberships that have no payment record yet.
// Fetches each membership from Whop API to get the billing amount.
export async function backfillMembershipPayments(): Promise<{ processed: number; created: number; skipped: number; errors: number }> {
  let processed = 0, created = 0, skipped = 0, errors = 0;
  try {
    // Find affiliate-attributed memberships with no payment
    const memberships = await db.select().from(whopMembershipsTable)
      .where(isNotNull(whopMembershipsTable.affiliateId));

    for (const m of memberships) {
      processed++;
      try {
        const existingPayment = await db.select().from(paymentsTable)
          .where(eq(paymentsTable.whopMembershipId, m.whopMembershipId)).limit(1);
        if (existingPayment.length > 0) { skipped++; continue; }

        // Fetch membership from Whop to get billing amount
        let amountCents: number | null = null;
        try {
          const resp = await whopFetch(`/memberships/${m.whopMembershipId}`);
          const mData = resp?.data ?? resp;
          amountCents = mData?.billing_amount ?? mData?.final_amount ?? mData?.plan?.price_amount ?? null;
          // Also try to upsert customer info
          if (mData?.user_id && !m.whopUserId) {
            await upsertCustomer(mData.user_id, mData.user?.email ?? null, mData.user?.name ?? null, null);
          }
        } catch (fetchErr) {
          logger.warn({ fetchErr, membershipId: m.whopMembershipId }, "Could not fetch membership from Whop for backfill");
          errors++;
          continue;
        }

        if (!amountCents || amountCents <= 0) { skipped++; continue; }

        const amount = amountCents / 100;
        const syntheticPaymentId = `mem_${m.whopMembershipId}_initial`;
        const [payment] = await db.insert(paymentsTable).values({
          whopPaymentId: syntheticPaymentId,
          whopMembershipId: m.whopMembershipId,
          affiliateId: m.affiliateId,
          grossAmount: String(amount),
          netAmount: String(amount),
          currency: "USD",
          paymentType: "initial",
          paidAt: m.startDate ?? new Date(),
          status: "paid",
          rawPayload: JSON.stringify({ source: "backfill", membershipId: m.whopMembershipId }),
        }).returning();

        await createCommissionForPayment(m.affiliateId!, payment.id, syntheticPaymentId, amount, "initial");
        created++;
        logger.info({ membershipId: m.whopMembershipId, affiliateId: m.affiliateId, amount }, "Backfilled payment for membership");
      } catch (err) {
        errors++;
        logger.error({ err, membershipId: m.whopMembershipId }, "Error backfilling membership payment");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in backfillMembershipPayments");
    errors++;
  }
  return { processed, created, skipped, errors };
}

async function upsertCustomer(whopUserId: string, email: string | null, fullName: string | null, country: string | null) {
  const existing = await db.select().from(whopCustomersTable)
    .where(eq(whopCustomersTable.whopUserId, whopUserId)).limit(1);
  if (existing.length === 0) {
    await db.insert(whopCustomersTable).values({ whopUserId, email, fullName, country, createdAt: new Date(), updatedAt: new Date() });
  } else {
    await db.update(whopCustomersTable).set({ email, fullName, country, updatedAt: new Date() })
      .where(eq(whopCustomersTable.whopUserId, whopUserId));
  }
}

// Whop v5 sends dates as ISO strings; older formats send Unix timestamps.
// This helper handles both safely.
function parseWhopDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    const d = new Date(value * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    const n = parseFloat(value);
    if (!isNaN(n)) return new Date(n * 1000);
  }
  return null;
}

export async function handleWebhookEvent(event: any): Promise<void> {
  const rawEventType = event.event ?? event.type ?? "";
  // Normalize: Whop V1 uses underscores (membership_activated), older formats use dots (membership.went_valid)
  // Convert underscores to dots for consistent matching, then check both forms.
  const eventType = rawEventType.replace(/_/g, ".");
  logger.info({ rawEventType, eventType }, "Processing Whop webhook event");

  // Log a sanitized summary of the payload for attribution debugging
  const payload0 = event.data ?? event;
  logger.info({
    eventType,
    payloadKeys: Object.keys(payload0 ?? {}),
    membershipId: payload0?.id ?? payload0?.membership_id,
    userId: payload0?.user_id,
    affiliateUsername: payload0?.affiliate_username,
    affcode: payload0?.affcode,
    metadataKeys: Object.keys(payload0?.metadata ?? {}),
    sid: payload0?.metadata?.sid,
  }, "Webhook payload summary");

  const payload = event.data ?? event;

  if (
    eventType === "membership.went.valid" ||   // normalized V1: membership_went_valid
    eventType === "membership.went_valid" ||    // old dot format
    eventType === "membership.activated"        // alternate dot format
  ) {
    await handleMembershipActivated(payload);
  } else if (
    eventType === "membership.went.invalid" ||  // normalized V1: membership_went_invalid
    eventType === "membership.went_invalid" ||
    eventType === "membership.deactivated"
  ) {
    await handleMembershipDeactivated(payload);
  } else if (eventType === "payment.succeeded" || eventType === "payment.completed") {
    await handlePaymentSucceeded(payload);
  } else if (eventType === "invoice.paid") {
    await handleInvoicePaid(payload);
  } else if (eventType === "invoice.past.due" || eventType === "invoice.past_due") {
    await handleInvoicePastDue(payload);
  } else if (eventType === "invoice.voided") {
    await handleInvoiceVoided(payload);
  } else {
    logger.info({ rawEventType }, "Unhandled Whop webhook event type — ignoring");
  }
}

async function resolveAffiliateFromWebhook(data: any): Promise<number | null> {
  // 1. Whop native affiliate system: affiliate_username field
  const affcode = data.affiliate_username ?? data.affcode ?? data.metadata?.affcode ?? null;
  if (affcode) {
    const affiliate = await db.select().from(affiliatesTable)
      .where(eq(affiliatesTable.affiliateCode, affcode)).limit(1);
    if (affiliate[0]) {
      logger.info({ affcode, affiliateId: affiliate[0].id }, "Attributed membership via affcode");
      return affiliate[0].id;
    }
  }

  // 2. Session ID fallback: match by sid we appended to the checkout URL
  const sid = data.metadata?.sid ?? data.checkout_session?.sid ?? null;
  if (sid) {
    const session = await db.select().from(referralSessionsTable)
      .where(eq(referralSessionsTable.sessionId, sid)).limit(1);
    if (session[0]) {
      logger.info({ sid, affiliateId: session[0].affiliateId }, "Attributed membership via session ID");
      return session[0].affiliateId;
    }
  }

  // 3. Last-click fallback: if there is only ONE affiliate with a recent unattributed
  //    click (within 30 minutes), attribute to them. This handles the case where Whop
  //    does not echo back our affcode/sid from the checkout URL.
  const windowStart = new Date(Date.now() - 30 * 60 * 1000);
  const recentClicks = await db.select({
    affiliateId: referralClicksTable.affiliateId,
    clickedAt: referralClicksTable.clickedAt,
  })
    .from(referralClicksTable)
    .where(gte(referralClicksTable.clickedAt, windowStart))
    .orderBy(desc(referralClicksTable.clickedAt))
    .limit(10);

  // Deduplicate to unique affiliate IDs
  const uniqueAffiliates = [...new Set(recentClicks.map((c) => c.affiliateId).filter(Boolean))];
  if (uniqueAffiliates.length === 1) {
    logger.info({ affiliateId: uniqueAffiliates[0], windowMinutes: 30 }, "Attributed membership via last-click fallback (only one affiliate active)");
    return uniqueAffiliates[0] as number;
  }

  if (uniqueAffiliates.length > 1) {
    // Multiple affiliates had clicks — take the most recent one but log a warning
    const mostRecentAffiliateId = recentClicks[0]?.affiliateId ?? null;
    logger.warn({ affiliateId: mostRecentAffiliateId, uniqueAffiliates, windowMinutes: 30 }, "Multiple affiliates had recent clicks — attributing to most recent (may be imprecise)");
    return mostRecentAffiliateId ?? null;
  }

  logger.info({}, "Could not resolve affiliate from webhook — no matching affcode, session, or recent click");
  return null;
}

async function handleMembershipActivated(data: any) {
  const membershipId = data.id ?? data.membership_id;
  if (!membershipId) return;

  const affiliateId = await resolveAffiliateFromWebhook(data);

  const existing = await db.select().from(whopMembershipsTable)
    .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1);

  // Whop v5 puts user data inside a `user` object; older formats used flat user_id
  const userId = data.user_id ?? data.user?.id ?? data.member?.user_id ?? null;
  const productId = data.product_id ?? data.product?.id ?? null;
  const planId = data.plan_id ?? data.plan?.id ?? null;

  const record = {
    whopMembershipId: membershipId,
    whopUserId: userId,
    whopProductId: productId,
    whopPlanId: planId,
    status: "active",
    startDate: parseWhopDate(data.created_at ?? data.joined_at) ?? new Date(),
    affiliateId: affiliateId ?? undefined,
    updatedAt: new Date(),
  };

  if (existing.length === 0) {
    await db.insert(whopMembershipsTable).values({ ...record, createdAt: new Date() });
  } else {
    // Only set affiliateId if we found one (don't overwrite an existing attribution)
    const updateRecord: typeof record = existing[0].affiliateId
      ? { ...record, affiliateId: existing[0].affiliateId }
      : record;
    await db.update(whopMembershipsTable).set(updateRecord).where(eq(whopMembershipsTable.whopMembershipId, membershipId));
  }

  if (userId) {
    await upsertCustomer(userId, data.user?.email ?? null, data.user?.name ?? data.user?.username ?? null, null);
  }

  // Mark the referral session as converted
  if (affiliateId) {
    await db.update(referralSessionsTable)
      .set({ attributed: true, conversionStatus: "converted", convertedAt: new Date() })
      .where(and(eq(referralSessionsTable.affiliateId, affiliateId), eq(referralSessionsTable.attributed, false)));

    // Also create a payment record for this activation so revenue is tracked immediately.
    // This acts as a fallback for cases where invoice_paid fires before membership_activated
    // or gets missed. If invoice_paid fires later with the same membership, it will deduplicate.
    await tryCreatePaymentFromMembership(membershipId, affiliateId, data);
  }
}

async function tryCreatePaymentFromMembership(membershipId: string, affiliateId: number, data: any) {
  const existingPayment = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.whopMembershipId, membershipId)).limit(1);
  if (existingPayment.length > 0) return; // Already recorded

  // Try to extract amount from webhook payload (Whop may include billing_amount in cents)
  let amountCents: number | null =
    data.billing_amount ?? data.final_amount ?? data.amount ?? data.price_cents ?? null;

  // Fall back to Whop API if the payload didn't include an amount
  if (!amountCents) {
    try {
      const resp = await whopFetch(`/memberships/${membershipId}`);
      const m = resp?.data ?? resp;
      amountCents = m?.billing_amount ?? m?.final_amount ?? null;
    } catch (err) {
      logger.warn({ err, membershipId }, "Could not fetch membership from Whop API for payment fallback");
      return;
    }
  }

  if (!amountCents || amountCents <= 0) return; // Free membership — no payment to record

  const amount = amountCents / 100;
  const syntheticPaymentId = `mem_${membershipId}_initial`;

  const [payment] = await db.insert(paymentsTable).values({
    whopPaymentId: syntheticPaymentId,
    whopMembershipId: membershipId,
    affiliateId,
    grossAmount: String(amount),
    netAmount: String(amount),
    currency: data.currency ?? "USD",
    paymentType: "initial",
    paidAt: new Date(),
    status: "paid",
    rawPayload: JSON.stringify({ source: "membership_activated_fallback" }),
  }).returning();

  logger.info({ membershipId, affiliateId, amount }, "Created payment record from membership_activated fallback");
  await createCommissionForPayment(affiliateId, payment.id, syntheticPaymentId, amount, "initial");
}

async function handleMembershipDeactivated(data: any) {
  const membershipId = data.id ?? data.membership_id;
  if (!membershipId) return;
  await db.update(whopMembershipsTable).set({ status: "expired", canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(whopMembershipsTable.whopMembershipId, membershipId));
}

// Handles Whop v5 payment.succeeded events — creates a payment record and commission.
async function handlePaymentSucceeded(data: any) {
  const paymentId = data.id ?? data.payment_id;
  if (!paymentId) return;

  // Deduplicate: also check if a synthetic "mem_" payment exists for this membership
  const membershipId = data.membership_id ?? data.membership?.id ?? null;
  const existing = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.whopPaymentId, paymentId)).limit(1);
  if (existing.length > 0) {
    logger.info({ paymentId }, "payment.succeeded: already recorded, skipping");
    return;
  }

  // If a synthetic payment was created from membership_activated, replace it
  if (membershipId) {
    const syntheticId = `mem_${membershipId}_initial`;
    const synthetic = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.whopPaymentId, syntheticId)).limit(1);
    if (synthetic.length > 0) {
      // Update synthetic payment to the real payment ID
      await db.update(paymentsTable)
        .set({ whopPaymentId: paymentId })
        .where(eq(paymentsTable.whopPaymentId, syntheticId));
      logger.info({ paymentId, syntheticId }, "payment.succeeded: upgraded synthetic payment to real payment");
      return;
    }
  }

  // Resolve affiliate: first from the stored membership, then via fallback resolution
  const membership = membershipId ? await db.select().from(whopMembershipsTable)
    .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1) : [];
  let affiliateId = membership[0]?.affiliateId ?? null;

  // If the membership exists but has no affiliate, try to resolve now
  if (!affiliateId) {
    affiliateId = await resolveAffiliateFromWebhook(data);
    // If we found one, back-fill it on the membership record so future payments are correct
    if (affiliateId && membershipId) {
      await db.update(whopMembershipsTable)
        .set({ affiliateId, updatedAt: new Date() })
        .where(eq(whopMembershipsTable.whopMembershipId, membershipId));
      logger.info({ membershipId, affiliateId }, "payment.succeeded: back-filled affiliate on membership");
    }
  }

  // Whop v5 payment fields are in DOLLARS (not cents):
  //   total / usd_total = dollar amount (e.g. 9.98 = $9.98)
  const amount = data.total ?? data.usd_total ?? data.final_amount ?? data.subtotal ?? 0;

  logger.info({ paymentId, membershipId, affiliateId, amount }, "payment.succeeded: processing payment");

  const isRenewal = !!(data.renewal || data.is_renewal || data.renewal_period_start);

  const [payment] = await db.insert(paymentsTable).values({
    whopPaymentId: paymentId,
    whopMembershipId: membershipId ?? null,
    affiliateId,
    grossAmount: String(amount),
    netAmount: String(amount),
    currency: (data.currency ?? "USD").toUpperCase(),
    paymentType: isRenewal ? "renewal" : "initial",
    paidAt: parseWhopDate(data.paid_at ?? data.created_at) ?? new Date(),
    status: "paid",
    rawPayload: JSON.stringify(data),
  }).returning();

  logger.info({ paymentId, membershipId, affiliateId, amount }, "payment.succeeded: recorded payment");

  if (affiliateId) {
    await createCommissionForPayment(affiliateId, payment.id, paymentId, amount, isRenewal ? "renewal" : "initial");
    logger.info({ paymentId, affiliateId, amount }, "payment.succeeded: commission created");
  }
}

async function handleInvoicePaid(data: any) {
  const paymentId = data.id ?? data.invoice_id;
  if (!paymentId) return;

  const existing = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.whopPaymentId, paymentId)).limit(1);
  if (existing.length > 0) return;

  const membershipId = data.membership_id;
  const membership = membershipId ? await db.select().from(whopMembershipsTable)
    .where(eq(whopMembershipsTable.whopMembershipId, membershipId)).limit(1) : [];
  const affiliateId = membership[0]?.affiliateId ?? null;
  const amount = data.final_amount ? data.final_amount / 100 : (data.amount ?? 0);

  const [payment] = await db.insert(paymentsTable).values({
    whopPaymentId: paymentId,
    whopMembershipId: membershipId ?? null,
    affiliateId,
    grossAmount: String(amount),
    netAmount: String(amount),
    currency: data.currency ?? "USD",
    paymentType: data.renewal ? "renewal" : "initial",
    paidAt: new Date(),
    status: "paid",
    rawPayload: JSON.stringify(data),
  }).returning();

  if (affiliateId) {
    await createCommissionForPayment(affiliateId, payment.id, paymentId, amount, data.renewal ? "renewal" : "initial");
  }
}

async function handleInvoicePastDue(data: any) {
  const paymentId = data.id ?? data.invoice_id;
  if (!paymentId) return;
  await db.update(paymentsTable).set({ status: "past_due" }).where(eq(paymentsTable.whopPaymentId, paymentId));
}

async function handleInvoiceVoided(data: any) {
  const paymentId = data.id ?? data.invoice_id;
  if (!paymentId) return;
  await db.update(paymentsTable).set({ status: "voided" }).where(eq(paymentsTable.whopPaymentId, paymentId));
  const payment = await db.select().from(paymentsTable).where(eq(paymentsTable.whopPaymentId, paymentId)).limit(1);
  if (payment[0]) {
    await db.update(commissionsTable).set({ commissionStatus: "voided", reason: "Invoice voided" })
      .where(eq(commissionsTable.paymentId, payment[0].id));
  }
}

async function createCommissionForPayment(affiliateId: number, paymentId: number | null, whopPaymentId: string, amount: number, paymentType: string) {
  const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId)).limit(1);
  if (!affiliate[0] || affiliate[0].status !== "active") return;

  const commType = affiliate[0].defaultCommissionType;
  const commValue = parseFloat(String(affiliate[0].defaultCommissionValue));
  let commAmount: number;
  if (commType === "flat") {
    commAmount = commValue;
  } else {
    commAmount = (amount * commValue) / 100;
  }

  await db.insert(commissionsTable).values({
    affiliateId,
    paymentId,
    commissionType: commType,
    commissionValue: String(commValue),
    commissionAmount: String(commAmount),
    commissionStatus: "pending",
    reason: `${paymentType === "renewal" ? "Renewal" : "Initial"} sale - ${whopPaymentId}`,
  });
}
