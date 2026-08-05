import { pgTable, serial, text, timestamp, integer, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appliesToEnum = pgEnum("applies_to", ["initial_sale", "renewal", "lifetime"]);

export const affiliateCommissionRulesTable = pgTable("affiliate_commission_rules", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  productId: text("product_id"),
  planId: text("plan_id"),
  commissionType: text("commission_type").notNull(),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull(),
  appliesTo: appliesToEnum("applies_to").notNull().default("initial_sale"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCommissionRuleSchema = createInsertSchema(affiliateCommissionRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type CommissionRule = typeof affiliateCommissionRulesTable.$inferSelect;
