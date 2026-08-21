import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// The customer's TradingView username, and whether you have granted them
// invite-only access to the indicator.
//
// 🔴 READ THIS BEFORE BUILDING ANYTHING ON TOP OF IT.
//
// TradingView has no OAuth and no public API for reading a user's charts, and
// its free embeddable widget will not load private or invite-only Pine scripts.
// So this table does NOT represent a connected account, and nothing downstream
// can render the customer's own TradingView inside our portal. What it holds is
// a claim ("this is my TradingView username") plus your decision about it.
//
// Granting is a MANUAL action you take in TradingView's own "Manage access"
// screen for the script. `status` records what you did, so the portal can tell
// the customer where they stand and deep-link them to the chart on
// tradingview.com. If that ever becomes automatable, the automation writes the
// same column and nothing else changes.
//
// One row per customer. When a customer edits their username the row returns to
// `pending`, because the new username has not been granted anything yet —
// leaving it `granted` would tell the customer they have access they do not.
export const tradingViewAccessStatusEnum = pgEnum("tradingview_access_status", [
  "pending",
  "granted",
  "rejected",
  "revoked",
]);

export const tradingViewAccessTable = pgTable("tradingview_access", {
  id: serial("id").primaryKey(),
  customerAccountId: integer("customer_account_id").notNull().unique(),
  // TradingView usernames are case-insensitive in practice; store as entered
  // and compare lowercased so "SteffonW" and "steffonw" are not two requests.
  tradingViewUsername: text("tradingview_username").notNull(),
  status: tradingViewAccessStatusEnum("status").notNull().default("pending"),
  // Set every time the customer submits or changes the username.
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
  // users.id of the admin who granted or rejected. Null while pending.
  decidedByUserId: integer("decided_by_user_id"),
  // Shown to the customer on rejection, so "rejected" is never unexplained.
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTradingViewAccessSchema = createInsertSchema(tradingViewAccessTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingViewAccess = z.infer<typeof insertTradingViewAccessSchema>;
export type TradingViewAccess = typeof tradingViewAccessTable.$inferSelect;
