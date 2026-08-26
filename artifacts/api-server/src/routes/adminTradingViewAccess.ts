import { Router, type IRouter } from "express";
import {
  db,
  tradingViewAccessTable,
  customerAccountsTable,
  adminAuditLogsTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

// The queue of customers waiting for invite-only access to the indicator.
//
// Mounted at /api/admin/tradingview — a specific prefix, NOT bare /admin.
// Four routers already share that mount and Express resolves them in mount
// order, so a path added to a later one is shadowed by an earlier one. See
// CLAUDE.md, "Request path / auth boundary".
//
// Granting is a MANUAL action in TradingView's own Manage-access screen. These
// endpoints record what you did; they cannot perform it. Nothing here reaches
// out to TradingView, because there is no API to reach.
const router: IRouter = Router();

type Decision = "granted" | "rejected" | "revoked";

async function writeAudit(
  adminUserId: number,
  action: string,
  targetId: number,
  oldValue: string | null,
  newValue: string
) {
  try {
    await db.insert(adminAuditLogsTable).values({
      adminUserId,
      action,
      targetType: "tradingview_access",
      targetId: String(targetId),
      oldValue,
      newValue,
    });
  } catch (err) {
    // An audit failure must not roll back a decision the admin has already
    // taken in TradingView — but it must be visible.
    console.error("tradingview audit write failed:", err);
  }
}

/**
 * GET /admin/tradingview — the queue.
 * ?status=pending|granted|rejected|revoked (default: pending, the work list)
 */
router.get("/tradingview", requireAdmin, async (req, res) => {
  try {
    const status = (req.query.status as string) ?? "pending";
    const valid = ["pending", "granted", "rejected", "revoked"];
    if (!valid.includes(status)) {
      res.status(400).json({ error: "Bad Request", message: `status must be one of ${valid.join(", ")}` });
      return;
    }

    const rows = await db
      .select({
        id: tradingViewAccessTable.id,
        customerAccountId: tradingViewAccessTable.customerAccountId,
        tradingViewUsername: tradingViewAccessTable.tradingViewUsername,
        status: tradingViewAccessTable.status,
        requestedAt: tradingViewAccessTable.requestedAt,
        decidedAt: tradingViewAccessTable.decidedAt,
        decisionNote: tradingViewAccessTable.decisionNote,
        email: customerAccountsTable.email,
        fullName: customerAccountsTable.fullName,
      })
      .from(tradingViewAccessTable)
      .leftJoin(
        customerAccountsTable,
        eq(customerAccountsTable.id, tradingViewAccessTable.customerAccountId)
      )
      .where(eq(tradingViewAccessTable.status, status as Decision | "pending"))
      .orderBy(desc(tradingViewAccessTable.requestedAt));

    const [{ value: pendingCount }] = await db
      .select({ value: count() })
      .from(tradingViewAccessTable)
      .where(eq(tradingViewAccessTable.status, "pending"));

    res.json({ requests: rows, pendingCount });
  } catch (err) {
    req.log.error({ err }, "TradingView queue fetch failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /admin/tradingview/:id/decision — record grant / reject / revoke.
 *
 * The UPDATE is guarded so a decision only applies to the username that was
 * actually reviewed. If the customer edited their username between the queue
 * being rendered and the button being pressed, the row is back to `pending`
 * with a different name, and this returns 409 rather than marking a username
 * granted that nobody looked at.
 */
router.post("/tradingview/:id/decision", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const decision = req.body?.decision as Decision | undefined;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
    const reviewedUsername =
      typeof req.body?.reviewedUsername === "string" ? req.body.reviewedUsername : null;

    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid id." });
      return;
    }
    if (!decision || !["granted", "rejected", "revoked"].includes(decision)) {
      res.status(400).json({
        error: "Bad Request",
        message: "decision must be one of: granted, rejected, revoked",
      });
      return;
    }
    if (decision === "rejected" && !note) {
      // A rejection the customer cannot understand generates a support ticket,
      // which costs more than typing the reason here.
      res.status(400).json({
        error: "Bad Request",
        message: "A note is required when rejecting — the customer is shown it.",
      });
      return;
    }

    const adminUserId = (req as any).user.id as number;
    const now = new Date();

    // Read the prior status before the UPDATE overwrites it, so the audit row
    // records a transition rather than just a destination.
    const [before] = await db
      .select({ status: tradingViewAccessTable.status })
      .from(tradingViewAccessTable)
      .where(eq(tradingViewAccessTable.id, id))
      .limit(1);
    const previousStatus = before?.status ?? null;

    const conditions = [eq(tradingViewAccessTable.id, id)];
    if (reviewedUsername) {
      conditions.push(eq(tradingViewAccessTable.tradingViewUsername, reviewedUsername));
    }

    const [updated] = await db
      .update(tradingViewAccessTable)
      .set({
        status: decision,
        decidedAt: now,
        decidedByUserId: adminUserId,
        decisionNote: note,
        updatedAt: now,
      })
      .where(and(...conditions))
      .returning();

    if (!updated) {
      const [current] = await db
        .select({ username: tradingViewAccessTable.tradingViewUsername })
        .from(tradingViewAccessTable)
        .where(eq(tradingViewAccessTable.id, id))
        .limit(1);

      if (current && reviewedUsername) {
        res.status(409).json({
          error: "Conflict",
          message:
            `The customer changed their username to "${current.username}" after you loaded this queue. ` +
            "Re-check it in TradingView before deciding.",
          currentUsername: current.username,
        });
        return;
      }
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await writeAudit(
      adminUserId,
      `tradingview_${decision}`,
      updated.id,
      previousStatus,
      `${decision}: ${updated.tradingViewUsername}${note ? ` — ${note}` : ""}`
    );

    res.json({ request: updated });
  } catch (err) {
    req.log.error({ err }, "TradingView decision failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
