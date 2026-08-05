import { Router, type IRouter } from "express";
import { db, payoutsTable, commissionsTable, affiliatesTable, usersTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, count, sql, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const payouts = await db.select({ payout: payoutsTable, user: usersTable, affiliate: affiliatesTable })
      .from(payoutsTable)
      .leftJoin(affiliatesTable, eq(payoutsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(status ? eq(payoutsTable.status, status as string) : undefined)
      .orderBy(desc(payoutsTable.createdAt)).limit(limitNum).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(payoutsTable)
      .where(status ? eq(payoutsTable.status, status as string) : undefined);

    const [pendingTotal] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0)` })
      .from(payoutsTable).where(eq(payoutsTable.status, "pending"));
    const [paidTotal] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0)` })
      .from(payoutsTable).where(eq(payoutsTable.status, "paid"));

    res.json({
      data: payouts.map(({ payout, user, affiliate }) => ({
        ...payout, totalAmount: parseFloat(String(payout.totalAmount)),
        affiliateName: user?.fullName ?? null, affiliateCode: affiliate?.affiliateCode ?? null,
      })),
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
      totalPending: Number(pendingTotal?.total ?? 0), totalPaid: Number(paidTotal?.total ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Get payouts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { affiliateId, commissionIds, payoutMethod, notes } = req.body;
    const admin = (req as any).user;

    const commissions = await db.select().from(commissionsTable)
      .where(and(eq(commissionsTable.affiliateId, affiliateId), inArray(commissionsTable.id, commissionIds)));

    if (commissions.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "No valid commissions found" }); return;
    }

    const totalAmount = commissions.reduce((sum, c) => sum + parseFloat(String(c.commissionAmount)), 0);
    const affiliate = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId)).limit(1);

    const [payout] = await db.insert(payoutsTable).values({
      affiliateId, totalAmount: String(totalAmount), currency: "USD",
      payoutMethod: payoutMethod ?? affiliate[0]?.payoutMethod ?? null,
      status: "pending", notes: notes ?? null,
    }).returning();

    await db.update(commissionsTable).set({ commissionStatus: "approved" })
      .where(inArray(commissionsTable.id, commissionIds));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id, action: "create_payout", targetType: "payout", targetId: String(payout.id),
      newValue: JSON.stringify({ affiliateId, totalAmount, commissionCount: commissions.length }),
    });

    res.status(201).json({ ...payout, totalAmount: parseFloat(String(payout.totalAmount)), affiliateName: null, affiliateCode: null });
  } catch (err) {
    req.log.error({ err }, "Create payout error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/mark-paid", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { payoutReference } = req.body;

    const payout = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id)).limit(1);
    if (!payout[0]) { res.status(404).json({ error: "Not Found" }); return; }

    await db.update(payoutsTable).set({ status: "paid", paidAt: new Date(), payoutReference: payoutReference ?? null })
      .where(eq(payoutsTable.id, id));

    const commissions = await db.select().from(commissionsTable).where(eq(commissionsTable.affiliateId, payout[0].affiliateId));
    const payableIds = commissions
      .filter(c => c.commissionStatus === "approved" || c.commissionStatus === "pending")
      .map(c => c.id);
    if (payableIds.length > 0) {
      await db.update(commissionsTable).set({ commissionStatus: "paid", paidAt: new Date() })
        .where(inArray(commissionsTable.id, payableIds));
    }

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id, action: "mark_payout_paid", targetType: "payout", targetId: String(id),
      newValue: JSON.stringify({ payoutReference }),
    });

    res.json({ success: true, message: "Payout marked as paid" });
  } catch (err) {
    req.log.error({ err }, "Mark payout paid error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export", requireAdmin, async (req, res) => {
  try {
    const payouts = await db.select({ payout: payoutsTable, user: usersTable, affiliate: affiliatesTable })
      .from(payoutsTable)
      .leftJoin(affiliatesTable, eq(payoutsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(payoutsTable.createdAt));

    const csv = [
      "ID,Affiliate,Code,Amount,Currency,Method,Status,Created,Paid",
      ...payouts.map(({ payout, user, affiliate }) =>
        `${payout.id},"${user?.fullName ?? ""}",${affiliate?.affiliateCode ?? ""},${payout.totalAmount},${payout.currency},"${payout.payoutMethod ?? ""}",${payout.status},${payout.createdAt.toISOString()},${payout.paidAt?.toISOString() ?? ""}`
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="payouts.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export payouts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
