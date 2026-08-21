import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// Short-lived numeric codes for customer email verification and password reset.
//
// A code is consumed by setting `usedAt`, never by deleting the row — the row
// is the evidence that a verification happened and when. `attempts` is checked
// before comparing, so a six-digit code cannot be brute-forced by replaying the
// same request.
export const customerEmailCodesTable = pgTable("customer_email_codes", {
  id: serial("id").primaryKey(),
  customerAccountId: integer("customer_account_id").notNull(),
  code: text("code").notNull(),
  // "verify_email" | "password_reset"
  purpose: text("purpose").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CustomerEmailCode = typeof customerEmailCodesTable.$inferSelect;
