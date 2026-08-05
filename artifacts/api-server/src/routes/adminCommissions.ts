import { Router, type IRouter } from "express";
import { db, commissionsTable, affiliatesTable, usersTable, paymentsTable, whopCustomersTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, count, sql, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, affiliateId, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause: any = undefined;
    if (status && affiliateId) {
      whereClause = and(eq(commissionsTable.commissionStatus, status as any), eq(commissionsTable.affiliateId, parseInt(affiliateId as string)));
    } else if (status) {
      whereClause = eq(commissionsTable.commissionStatus, status as any);
    } else if (affiliateId) {
      whereClause = eq(commissionsTable.affiliateId, parseInt(affiliateId as string));
    }

    const commissions = await db.select({
      commission: commissionsTable,
      user: usersTable,
      affiliate: affiliatesTable,
    })
      .from(commissionsTable)
      .leftJoin(affiliatesTable, eq(commissionsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(commissionsTable.createdAt)).limit(limitNum).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(commissionsTable).where(whereClause);
    const [pendingTotal] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
      .from(commissionsTable).where(and(whereClause, eq(commissionsTable.commissionStatus, "pending")));
    const [approvedTotal] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(commission_amount AS NUMERIC)), 0)` })
      .from(commissionsTable).where(and(whereClause, eq(commissionsTable.commissionStatus, "approved")));

    res.json({
      data: commissions.map(({ commission, user }) => ({
        ...commission,
        commissionValue: parseFloat(String(commission.commissionValue)),
        commissionAmount: parseFloat(String(commission.commissionAmount)),
        affiliateName: user?.fullName ?? null,
        customerEmail: null,
      })),
      total: Number(totalResult?.count ?? 0), page: pageNum, limit: limitNum,
      totalPending: Number(pendingTotal?.total ?? 0),
      totalApproved: Number(approvedTotal?.total ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Get commissions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const admin = (req as any).user;
    const { commissionAmount, commissionStatus, reason } = req.body;

    const [old] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id)).limit(1);

    const updates: Record<string, any> = {};
    if (commissionAmount != null) updates.commissionAmount = String(commissionAmount);
    if (commissionStatus) updates.commissionStatus = commissionStatus;
    if (reason) updates.reason = reason;

    await db.update(commissionsTable).set(updates).where(eq(commissionsTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: "adjust_commission",
      targetType: "commission",
      targetId: String(id),
      oldValue: JSON.stringify({ amount: old?.commissionAmount, status: old?.commissionStatus }),
      newValue: JSON.stringify({ amount: commissionAmount ?? old?.commissionAmount, status: commissionStatus ?? old?.commissionStatus, reason }),
    });

    res.json({ success: true, message: "Commission updated" });
  } catch (err) {
    req.log.error({ err }, "Adjust commission error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
