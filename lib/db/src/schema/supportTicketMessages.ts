import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  senderType: text("sender_type").notNull(), // "affiliate" | "customer" | "admin"
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportTicketMessageSchema = createInsertSchema(supportTicketMessagesTable).omit({ id: true, createdAt: true });
export type InsertSupportTicketMessage = z.infer<typeof insertSupportTicketMessageSchema>;
export type SupportTicketMessage = typeof supportTicketMessagesTable.$inferSelect;
