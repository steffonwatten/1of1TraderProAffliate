import { Router, type IRouter } from "express";
import { db, affiliateApplicationsTable, affiliatesTable, usersTable, referralClicksTable, referralSessionsTable, leadSignupsTable, passwordResetTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword, generateAffiliateCode } from "../lib/auth";
import { sendApplicationApproved } from "../lib/email";

// Extract country from request headers (Cloudflare first, then other CDNs)
function countryFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const cf = headers["cf-ipcountry"];
  if (cf && cf !== "XX" && cf !== "T1") return (Array.isArray(cf) ? cf[0] : cf).toUpperCase();
  const xc = headers["x-country"] ?? headers["x-vercel-ip-country"];
  if (xc) return (Array.isArray(xc) ? xc[0] : xc).toUpperCase();
  return null;
}

// Async fire-and-forget country lookup from IP — updates the click row after the redirect is sent
async function lookupAndStoreCountry(clickSessionId: string, ip: string): Promise<void> {
  try {
    // Skip private/loopback/test IPs
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("172.") || ip.startsWith("192.168.")) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,status`, { signal: controller.signal });
    clearTimeout(timeout);
    const data: any = await res.json();
    if (data?.status === "success" && data?.countryCode) {
      await db.update(referralClicksTable)
        .set({ country: data.countryCode })
        .where(eq(referralClicksTable.sessionId, clickSessionId));
    }
  } catch {
    // silent — geolocation is best-effort
  }
}

const router: IRouter = Router();

router.post("/affiliate/apply", async (req, res) => {
  try {
    const {
      fullName, email, phone, country, telegram, discord,
      websiteUrl, twitterUrl, youtubeUrl, audienceType,
      communitySize, trafficSources, whyJoin, tradingExperience,
      payoutMethod, payoutDetails,
    } = req.body;

    if (!fullName || !email || !phone || !country || !audienceType || !communitySize || !trafficSources || !whyJoin || !tradingExperience) {
      res.status(400).json({ error: "Bad Request", message: "Missing required fields" });
      return;
    }

    const lowerEmail = email.toLowerCase();

    const existingApp = await db.select().from(affiliateApplicationsTable)
      .where(eq(affiliateApplicationsTable.email, lowerEmail)).limit(1);
    if (existingApp.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "An application with this email already exists" });
      return;
    }

    // Check if a user already exists with this email
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, lowerEmail)).limit(1);
    if (existingUser.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "An account with this email already exists. Please log in." });
      return;
    }

    // Generate affiliate code up front
    const affiliateCode = generateAffiliateCode(fullName);
    const baseUrl = process.env.BASE_URL ?? "https://affiliates1of1trader.pro";
    const referralUrl = `${baseUrl}/api/r/${affiliateCode}`;

    // Create user account with an unusable random password. The affiliate sets
    // their own password via the setup link emailed below.
    const [newUser] = await db.insert(usersTable).values({
      email: lowerEmail,
      passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
      fullName,
      role: "affiliate",
      status: "active",
    }).returning();

    // Create affiliate record
    await db.insert(affiliatesTable).values({
      userId: newUser.id,
      affiliateCode,
      referralSlug: affiliateCode,
      referralUrl,
      defaultCommissionType: "flat",
      defaultCommissionValue: "25",
      payoutMethod: payoutMethod ?? null,
      payoutDetails: payoutDetails ?? null,
      status: "active",
    });

    // Save the application as approved
    await db.insert(affiliateApplicationsTable).values({
      fullName,
      email: lowerEmail,
      phone,
      country,
      telegram: telegram ?? null,
      discord: discord ?? null,
      websiteUrl: websiteUrl ?? null,
      twitterUrl: twitterUrl ?? null,
      youtubeUrl: youtubeUrl ?? null,
      audienceType,
      communitySize,
      trafficSources,
      whyJoin,
      tradingExperience,
      payoutMethod: payoutMethod ?? null,
      payoutDetails: payoutDetails ?? null,
      status: "approved",
      reviewedAt: new Date(),
    });

    // Generate a password setup token (valid 7 days) and build the setup link
    const setupToken = crypto.randomBytes(32).toString("hex");
    await db.insert(passwordResetTokensTable).values({
      userId: newUser.id,
      token: setupToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const setPasswordUrl = `${baseUrl}/reset-password?token=${setupToken}`;

    // Send approval email with a set-password link (non-blocking)
    sendApplicationApproved(lowerEmail, fullName, affiliateCode, setPasswordUrl, referralUrl)
      .catch((err) => req.log.error({ err }, "Failed to send approval email"));

    res.status(201).json({ success: true, message: "Application approved! Check your email to set your password and sign in." });
  } catch (err) {
    req.log.error({ err }, "Submit application error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/r/:referralCode", async (req, res) => {
  try {
    const { referralCode } = req.params;
    const affiliate = await db.select().from(affiliatesTable)
      .where(eq(affiliatesTable.affiliateCode, referralCode)).limit(1);

    const sessionId = crypto.randomUUID();
    const ipRaw = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const ipHash = crypto.createHash("sha256").update(ipRaw + process.env.SESSION_SECRET).digest("hex");

    if (affiliate[0]) {
      // Prefer Cloudflare geo header; fall back to async IP lookup
      const country = countryFromHeaders(req.headers as Record<string, string | string[] | undefined>);

      await db.insert(referralClicksTable).values({
        affiliateId: affiliate[0].id,
        referralCode,
        ipHash,
        country,
        userAgent: req.headers["user-agent"] ?? null,
        referrerUrl: req.headers.referer ?? null,
        landingPage: req.query.landing as string ?? "/",
        utmSource: req.query.utm_source as string ?? null,
        utmMedium: req.query.utm_medium as string ?? null,
        utmCampaign: req.query.utm_campaign as string ?? null,
        sessionId,
      });

      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(referralSessionsTable).values({
        affiliateId: affiliate[0].id,
        sessionId,
        attributed: false,
        conversionStatus: "clicked",
        expiresAt: thirtyDaysOut,
      }).onConflictDoNothing();

      // If no header country, fire-and-forget IP lookup as fallback
      if (!country) lookupAndStoreCountry(sessionId, ipRaw).catch(() => {});
    }

    // Send to the Whop product page with the affiliate code embedded.
    // Whop reads `affcode` and stores it with the membership — it comes back
    // in the membership.went_valid webhook so we can attribute the commission.
    // `sid` is our session ID for fallback matching.
    const checkoutBase = process.env.WHOP_CHECKOUT_URL ?? "https://whop.com/1of1-trader-pro/1of1-trader-pro-gold-version/";
    const checkoutUrl = `${checkoutBase}?affcode=${referralCode}&sid=${sessionId}`;
    res.redirect(302, checkoutUrl);
  } catch (err) {
    req.log.error({ err }, "Referral redirect error");
    res.redirect(302, "https://1of1traderpro.com");
  }
});

router.post("/track/click", async (req, res) => {
  try {
    const { affiliateCode, ipAddress, userAgent, referrerUrl, landingPage, utmSource, utmMedium, utmCampaign, sessionId } = req.body;
    if (!affiliateCode) {
      res.status(400).json({ error: "Bad Request", message: "affiliateCode required" });
      return;
    }
    const affiliate = await db.select().from(affiliatesTable)
      .where(eq(affiliatesTable.affiliateCode, affiliateCode)).limit(1);
    if (!affiliate[0]) {
      res.status(404).json({ error: "Not Found", message: "Affiliate not found" });
      return;
    }

    const newSessionId = sessionId ?? crypto.randomUUID();
    const ipRaw = ipAddress ?? (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const ipHash = crypto.createHash("sha256").update(ipRaw).digest("hex");

    // Cloudflare geo header → IP lookup fallback
    const country = countryFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    const [click] = await db.insert(referralClicksTable).values({
      affiliateId: affiliate[0].id,
      referralCode: affiliateCode,
      ipHash,
      country,
      userAgent: userAgent ?? req.headers["user-agent"] ?? null,
      referrerUrl: referrerUrl ?? req.headers.referer ?? null,
      landingPage: landingPage ?? null,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      sessionId: newSessionId,
    }).returning();

    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(referralSessionsTable).values({
      affiliateId: affiliate[0].id,
      sessionId: newSessionId,
      firstClickId: click.id,
      attributed: false,
      conversionStatus: "clicked",
      expiresAt: thirtyDaysOut,
    }).onConflictDoNothing();

    // If no header country, fire-and-forget IP lookup as fallback
    if (!country) lookupAndStoreCountry(newSessionId, ipRaw).catch(() => {});

    res.json({ clickId: click.id, sessionId: newSessionId, affiliateCode });
  } catch (err) {
    req.log.error({ err }, "Track click error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/track/lead", async (req, res) => {
  try {
    const { sessionId, email, fullName } = req.body;
    if (!sessionId || !email) {
      res.status(400).json({ error: "Bad Request", message: "sessionId and email required" });
      return;
    }
    const session = await db.select().from(referralSessionsTable)
      .where(eq(referralSessionsTable.sessionId, sessionId)).limit(1);
    if (!session[0]) {
      res.status(404).json({ error: "Not Found", message: "Session not found" });
      return;
    }
    await db.insert(leadSignupsTable).values({
      affiliateId: session[0].affiliateId,
      sessionId,
      email: email.toLowerCase(),
      fullName: fullName ?? null,
      source: "referral",
    });
    await db.update(referralSessionsTable).set({ conversionStatus: "lead", lastSeenAt: new Date() })
      .where(eq(referralSessionsTable.sessionId, sessionId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Track lead error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
