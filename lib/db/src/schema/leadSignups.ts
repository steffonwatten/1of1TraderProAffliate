import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadSignupsTable = pgTable("lead_signups", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull(),
  sessionId: text("session_id"),
  email: text("email").notNull(),
  fullName: text("full_name"),
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSignupSchema = createInsertSchema(leadSignupsTable).omit({ id: true, createdAt: true });
export type InsertLeadSignup = z.infer<typeof insertLeadSignupSchema>;
export type LeadSignup = typeof leadSignupsTable.$inferSelect;
