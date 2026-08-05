import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  whopPaymentId: text("whop_payment_id").unique(),
  whopMembershipId: text("whop_membership_id"),
  customerId: integer("customer_id"),
  affiliateId: integer("affiliate_id"),
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  paymentType: text("payment_type").notNull().default("initial"),
  paidAt: timestamp("paid_at"),
  status: text("status").notNull().default("paid"),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
