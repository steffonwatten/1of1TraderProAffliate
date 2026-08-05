import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignLinksTable = pgTable("campaign_links", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  landingPage: text("landing_page"),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignLinkSchema = createInsertSchema(campaignLinksTable).omit({ id: true, createdAt: true, clicks: true });
export type InsertCampaignLink = z.infer<typeof insertCampaignLinkSchema>;
export type CampaignLink = typeof campaignLinksTable.$inferSelect;
