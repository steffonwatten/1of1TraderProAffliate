import { Router, type IRouter } from "express";
import { db, supportTicketsTable, supportTicketMessagesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/support-tickets", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(supportTicketsTable) as any;
    let countQuery = db.select({ count: count() }).from(supportTicketsTable) as any;

    if (status) {
      query = query.where(eq(supportTicketsTable.status, status as string));
      countQuery = countQuery.where(eq(supportTicketsTable.status, status as string));
    }

    const [data, totalResult] = await Promise.all([
      query.orderBy(desc(supportTicketsTable.createdAt)).limit(limitNum).offset(offset),
      countQuery,
    ]);

    res.json({ data, total: totalResult[0]?.count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Get support tickets error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/support-tickets/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const ticket = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!ticket[0]) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(ticket[0]);
  } catch (err) {
    req.log.error({ err }, "Get support ticket error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/support-tickets/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status, adminNotes } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (status === "resolved" && !updates.resolvedAt) updates.resolvedAt = new Date();

    await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Update support ticket error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get messages for a ticket
router.get("/support-tickets/:id/messages", requireAdmin, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id as string);
    const [ticket, messages] = await Promise.all([
      db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId)).limit(1),
      db.select().from(supportTicketMessagesTable)
        .where(eq(supportTicketMessagesTable.ticketId, ticketId))
        .orderBy(supportTicketMessagesTable.createdAt),
    ]);
    if (!ticket[0]) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ ticket: ticket[0], messages });
  } catch (err) {
    req.log.error({ err }, "Get ticket messages error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin sends a reply
router.post("/support-tickets/:id/reply", requireAdmin, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id as string);
    const adminUser = (req as any).user;
    const { message } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

    const ticket = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId)).limit(1);
    if (!ticket[0]) { res.status(404).json({ error: "Not Found" }); return; }

    // Mark in_progress if it was open
    if (ticket[0].status === "open") {
      await db.update(supportTicketsTable).set({ status: "in_progress", updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticketId));
    }

    const [msg] = await db.insert(supportTicketMessagesTable).values({
      ticketId,
      senderType: "admin",
      senderName: adminUser.fullName ?? "Support Team",
      message: message.trim(),
    }).returning();

    // Send email notification to affiliate
    const { sendAdminReply } = await import("../lib/email");
    sendAdminReply(ticket[0].affiliateEmail, ticket[0].affiliateName, ticket[0].subject, message.trim())
      .catch(() => {});

    res.json(msg);
  } catch (err) {
    req.log.error({ err }, "Admin reply error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
