import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const referralClicksTable = pgTable("referral_clicks", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  referralCode: text("referral_code").notNull(),
  ipHash: text("ip_hash"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  userAgent: text("user_agent"),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  sessionId: text("session_id"),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
});

export const insertReferralClickSchema = createInsertSchema(referralClicksTable).omit({ id: true, clickedAt: true });
export type InsertReferralClick = z.infer<typeof insertReferralClickSchema>;
export type ReferralClick = typeof referralClicksTable.$inferSelect;
