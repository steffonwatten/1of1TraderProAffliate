import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whopMembershipsTable = pgTable("whop_memberships", {
  id: serial("id").primaryKey(),
  whopMembershipId: text("whop_membership_id").notNull().unique(),
  whopUserId: text("whop_user_id"),
  whopProductId: text("whop_product_id"),
  whopPlanId: text("whop_plan_id"),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date"),
  renewalDate: timestamp("renewal_date"),
  canceledAt: timestamp("canceled_at"),
  affiliateId: integer("affiliate_id"),
  attributedSessionId: text("attributed_session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWhopMembershipSchema = createInsertSchema(whopMembershipsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWhopMembership = z.infer<typeof insertWhopMembershipSchema>;
export type WhopMembership = typeof whopMembershipsTable.$inferSelect;
