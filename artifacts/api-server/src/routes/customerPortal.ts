import { Router, type IRouter } from "express";
import {
  db,
  tradingViewAccessTable,
  supportTicketsTable,
  supportTicketMessagesTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireCustomer, getReqCustomer } from "../lib/customerAuth";

// The indicator customer's own surfaces. Mounted at /api/customer, every route
// behind requireCustomer.
const router: IRouter = Router();

// TradingView usernames: letters, digits and underscore, 2-30 chars. Rejecting
// a pasted profile URL here is kinder than letting it through and having the
// grant silently fail later against a username that does not exist.
const TV_USERNAME = /^[A-Za-z0-9_]{2,30}$/;

/**
 * GET /customer/tradingview — current access state.
 *
 * `chartUrl` is a link OUT to tradingview.com. It is not an embed and cannot
 * be: TradingView's public widget will not load invite-only Pine scripts, and
 * there is no API to read a user's charts. See lib/db/src/schema/tradingViewAccess.ts.
 */
router.get("/tradingview", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const [row] = await db
      .select()
      .from(tradingViewAccessTable)
      .where(eq(tradingViewAccessTable.customerAccountId, customer.id))
      .limit(1);

    if (!row) {
      res.json({ status: "not_submitted", tradingViewUsername: null });
      return;
    }

    res.json({
      status: row.status,
      tradingViewUsername: row.tradingViewUsername,
      requestedAt: row.requestedAt,
      decidedAt: row.decidedAt,
      // Only surfaced on rejection — there is nothing to explain otherwise.
      decisionNote: row.status === "rejected" ? row.decisionNote : null,
      chartUrl: row.status === "granted" ? "https://www.tradingview.com/chart/" : null,
    });
  } catch (err) {
    req.log.error({ err }, "TradingView status fetch failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PUT /customer/tradingview — submit or change the username.
 *
 * Changing it returns the row to `pending`, because access was granted to the
 * OLD username and the new one has been granted nothing. Leaving it `granted`
 * would tell the customer they have access they do not have.
 */
router.put("/tradingview", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const raw = typeof req.body?.tradingViewUsername === "string"
      ? req.body.tradingViewUsername.trim().replace(/^@/, "")
      : "";

    if (!TV_USERNAME.test(raw)) {
      res.status(400).json({
        error: "Bad Request",
        message:
          "Enter your TradingView username (letters, numbers and underscores only) — not your email or a profile link.",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(tradingViewAccessTable)
      .where(eq(tradingViewAccessTable.customerAccountId, customer.id))
      .limit(1);

    const now = new Date();

    if (!existing) {
      const [created] = await db
        .insert(tradingViewAccessTable)
        .values({ customerAccountId: customer.id, tradingViewUsername: raw, status: "pending" })
        .returning();
      res.status(201).json({ status: created.status, tradingViewUsername: created.tradingViewUsername });
      return;
    }

    // Case-insensitive: TradingView treats "SteffonW" and "steffonw" as the
    // same account, so re-submitting a different casing is not a new request
    // and must not reset a granted row to pending.
    if (existing.tradingViewUsername.toLowerCase() === raw.toLowerCase()) {
      res.json({
        status: existing.status,
        tradingViewUsername: existing.tradingViewUsername,
        unchanged: true,
      });
      return;
    }

    const [updated] = await db
      .update(tradingViewAccessTable)
      .set({
        tradingViewUsername: raw,
        status: "pending",
        requestedAt: now,
        decidedAt: null,
        decidedByUserId: null,
        decisionNote: null,
        updatedAt: now,
      })
      .where(eq(tradingViewAccessTable.customerAccountId, customer.id))
      .returning();

    res.json({ status: updated.status, tradingViewUsername: updated.tradingViewUsername });
  } catch (err) {
    req.log.error({ err }, "TradingView username submission failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** GET /customer/support/tickets — this customer's threads only. */
router.get("/support/tickets", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.requesterType, "customer"),
          eq(supportTicketsTable.customerAccountId, customer.id)
        )
      )
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json({ tickets });
  } catch (err) {
    req.log.error({ err }, "Customer ticket list failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/support/tickets — open a thread. */
router.post("/support/tickets", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category.trim() : null;

    if (!subject || !message) {
      res.status(400).json({ error: "Bad Request", message: "Subject and message are required." });
      return;
    }
    if (subject.length > 200 || message.length > 5000) {
      res.status(400).json({ error: "Bad Request", message: "Subject or message is too long." });
      return;
    }

    const senderName = customer.fullName ?? customer.email;
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        requesterType: "customer",
        customerAccountId: customer.id,
        // Misnamed columns holding the requester's details whatever the type —
        // see the note on the schema. affiliateId stays null for customers.
        affiliateName: senderName,
        affiliateEmail: customer.email,
        category,
        subject,
        message,
        status: "open",
      })
      .returning();

    await db.insert(supportTicketMessagesTable).values({
      ticketId: ticket.id,
      senderType: "customer",
      senderName,
      message,
    });

    res.status(201).json({ ticket });
  } catch (err) {
    req.log.error({ err }, "Customer ticket creation failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** GET /customer/support/tickets/:id/messages */
router.get("/support/tickets/:id/messages", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid ticket id." });
      return;
    }

    // Ownership is checked before any message is read. Without this a customer
    // could page through every ticket in the system, including affiliates'.
    const [ticket] = await db
      .select({ id: supportTicketsTable.id })
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, id),
          eq(supportTicketsTable.requesterType, "customer"),
          eq(supportTicketsTable.customerAccountId, customer.id)
        )
      )
      .limit(1);

    if (!ticket) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const messages = await db
      .select()
      .from(supportTicketMessagesTable)
      .where(eq(supportTicketMessagesTable.ticketId, id))
      .orderBy(supportTicketMessagesTable.createdAt);

    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "Customer ticket messages fetch failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/support/tickets/:id/reply */
router.post("/support/tickets/:id/reply", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const id = Number(req.params.id);
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!Number.isInteger(id) || !message) {
      res.status(400).json({ error: "Bad Request", message: "A message is required." });
      return;
    }
    if (message.length > 5000) {
      res.status(400).json({ error: "Bad Request", message: "Message is too long." });
      return;
    }

    const [ticket] = await db
      .select({ id: supportTicketsTable.id, status: supportTicketsTable.status })
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, id),
          eq(supportTicketsTable.requesterType, "customer"),
          eq(supportTicketsTable.customerAccountId, customer.id)
        )
      )
      .limit(1);

    if (!ticket) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await db.insert(supportTicketMessagesTable).values({
      ticketId: id,
      senderType: "customer",
      senderName: customer.fullName ?? customer.email,
      message,
    });

    // A reply on a resolved thread reopens it, so a follow-up question does not
    // sit unread in a closed ticket.
    await db
      .update(supportTicketsTable)
      .set({ status: "open", updatedAt: sql`now()` })
      .where(eq(supportTicketsTable.id, id));

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Customer ticket reply failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
