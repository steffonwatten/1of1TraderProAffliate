import { Router, type IRouter } from "express";
import { db, affiliateApplicationsTable, usersTable, affiliatesTable, adminAuditLogsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { hashPassword, generateAffiliateCode } from "../lib/auth";
import { sendApplicationApproved, sendApplicationDenied } from "../lib/email";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(affiliateApplicationsTable);
    if (status) {
      query = query.where(eq(affiliateApplicationsTable.status, status as any)) as any;
    }

    const [data, totalResult] = await Promise.all([
      query.orderBy(desc(affiliateApplicationsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(affiliateApplicationsTable).where(status ? eq(affiliateApplicationsTable.status, status as any) : undefined),
    ]);

    res.json({ data, total: totalResult[0]?.count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Get applications error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const app = await db.select().from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.id, id)).limit(1);
    if (!app[0]) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(app[0]);
  } catch (err) {
    req.log.error({ err }, "Get application error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { notes } = req.body;

    const app = await db.select().from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.id, id)).limit(1);
    if (!app[0]) { res.status(404).json({ error: "Not Found" }); return; }
    if (app[0].status !== "pending") {
      res.status(400).json({ error: "Bad Request", message: "Application already reviewed" }); return;
    }

    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, app[0].email)).limit(1);
    let userId: number;

    if (existingUser.length === 0) {
      // Create the account with an unusable random password. The affiliate sets
      // their own password via the setup link emailed below.
      const [newUser] = await db.insert(usersTable).values({
        email: app[0].email,
        passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
        fullName: app[0].fullName,
        role: "affiliate",
        status: "active",
      }).returning();
      userId = newUser.id;
    } else {
      userId = existingUser[0].id;
    }

    const affiliateCode = generateAffiliateCode(app[0].fullName);
    const baseUrl = process.env.BASE_URL ?? "https://affiliates1of1trader.pro";
    const referralUrl = `${baseUrl}/api/r/${affiliateCode}`;

    await db.insert(affiliatesTable).values({
      userId,
      affiliateCode,
      referralSlug: affiliateCode,
      referralUrl,
      defaultCommissionType: "flat",
      defaultCommissionValue: "25",
      payoutMethod: app[0].payoutMethod ?? null,
      payoutDetails: app[0].payoutDetails ?? null,
      status: "active",
    });

    await db.update(affiliateApplicationsTable).set({
      status: "approved",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      notes: notes ?? null,
    }).where(eq(affiliateApplicationsTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "approve_application",
      targetType: "affiliate_application",
      targetId: String(id),
      newValue: JSON.stringify({ affiliateCode, userId }),
    });

    // Generate a password setup token (valid 7 days) and build the setup link
    const setupToken = crypto.randomBytes(32).toString("hex");
    await db.insert(passwordResetTokensTable).values({
      userId,
      token: setupToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const setPasswordUrl = `${baseUrl}/reset-password?token=${setupToken}`;

    // Send approval email with a set-password link (non-blocking)
    sendApplicationApproved(app[0].email, app[0].fullName, affiliateCode, setPasswordUrl, referralUrl)
      .catch((err) => req.log.error({ err }, "Failed to send approval email"));

    res.json({ success: true, affiliateCode });
  } catch (err) {
    req.log.error({ err }, "Approve application error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/deny", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { notes } = req.body;

    const app = await db.select().from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.id, id)).limit(1);
    if (!app[0]) { res.status(404).json({ error: "Not Found" }); return; }

    await db.update(affiliateApplicationsTable).set({
      status: "denied",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      notes: notes ?? null,
    }).where(eq(affiliateApplicationsTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "deny_application",
      targetType: "affiliate_application",
      targetId: String(id),
    });

    // Send denial email (non-blocking)
    sendApplicationDenied(app[0].email, app[0].fullName, notes)
      .catch((err) => req.log.error({ err }, "Failed to send denial email"));

    res.json({ success: true, message: "Application denied" });
  } catch (err) {
    req.log.error({ err }, "Deny application error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
