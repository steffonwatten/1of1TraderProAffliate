import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One inbox for both populations. `requesterType` says which, and exactly one
// of `affiliateId` / `customerAccountId` is set accordingly.
//
// ⚠️ `affiliateId` was NOT NULL until customers were added; the migration drops
// that constraint. Every pre-existing row is an affiliate ticket, which is why
// `requesterType` defaults to "affiliate" — the default backfills history
// correctly without an UPDATE over the table.
//
// `affiliateName` / `affiliateEmail` are misnamed now: they hold the requester's
// name and email whatever the type. They are NOT renamed on purpose — a rename
// breaks every existing query the moment it lands, for no behaviour gain. Read
// them as requesterName / requesterEmail.
export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  requesterType: text("requester_type").notNull().default("affiliate"),
  affiliateId: integer("affiliate_id"),
  customerAccountId: integer("customer_account_id"),
  affiliateName: text("affiliate_name").notNull(),
  affiliateEmail: text("affiliate_email").notNull(),
  category: text("category"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
