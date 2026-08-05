import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "denied"]);

export const affiliateApplicationsTable = pgTable("affiliate_applications", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  telegram: text("telegram"),
  discord: text("discord"),
  websiteUrl: text("website_url"),
  twitterUrl: text("twitter_url"),
  youtubeUrl: text("youtube_url"),
  audienceType: text("audience_type").notNull(),
  communitySize: text("community_size").notNull(),
  trafficSources: text("traffic_sources").notNull(),
  whyJoin: text("why_join").notNull(),
  tradingExperience: text("trading_experience").notNull(),
  payoutMethod: text("payout_method"),
  payoutDetails: text("payout_details"),
  status: applicationStatusEnum("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApplicationSchema = createInsertSchema(affiliateApplicationsTable).omit({ id: true, createdAt: true, status: true, reviewedBy: true, reviewedAt: true, notes: true });
export type InsertAffiliateApplication = z.infer<typeof insertApplicationSchema>;
export type AffiliateApplication = typeof affiliateApplicationsTable.$inferSelect;
