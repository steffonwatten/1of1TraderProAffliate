import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const referralSessionsTable = pgTable("referral_sessions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  sessionId: text("session_id").notNull().unique(),
  firstClickId: integer("first_click_id"),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  country: text("country"),
  attributed: boolean("attributed").notNull().default(false),
  conversionStatus: text("conversion_status").default("clicked"),
  convertedAt: timestamp("converted_at"),
  expiresAt: timestamp("expires_at"),
});

export const insertReferralSessionSchema = createInsertSchema(referralSessionsTable).omit({ id: true, firstSeenAt: true, lastSeenAt: true });
export type InsertReferralSession = z.infer<typeof insertReferralSessionSchema>;
export type ReferralSession = typeof referralSessionsTable.$inferSelect;
