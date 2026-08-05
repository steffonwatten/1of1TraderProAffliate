import { pgTable, serial, text, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionTypeEnum = pgEnum("commission_type", ["flat", "percent"]);
export const affiliateStatusEnum = pgEnum("affiliate_status", ["active", "paused", "terminated"]);

export const affiliatesTable = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  affiliateCode: text("affiliate_code").notNull().unique(),
  referralSlug: text("referral_slug").notNull().unique(),
  referralUrl: text("referral_url").notNull(),
  defaultCommissionType: commissionTypeEnum("default_commission_type").notNull().default("percent"),
  defaultCommissionValue: numeric("default_commission_value", { precision: 10, scale: 2 }).notNull().default("20"),
  payoutMethod: text("payout_method"),
  payoutDetails: text("payout_details"),
  status: affiliateStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAffiliateSchema = createInsertSchema(affiliatesTable).omit({ id: true, createdAt: true });
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Affiliate = typeof affiliatesTable.$inferSelect;
