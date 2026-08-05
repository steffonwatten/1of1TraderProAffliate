import { pgTable, serial, text, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionStatusEnum = pgEnum("commission_status", ["pending", "approved", "paid", "voided"]);

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  paymentId: integer("payment_id"),
  customerId: integer("customer_id"),
  commissionType: text("commission_type").notNull().default("percent"),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull(),
  commissionStatus: commissionStatusEnum("commission_status").notNull().default("pending"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({ id: true, createdAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
