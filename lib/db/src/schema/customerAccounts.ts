import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Login for an indicator CUSTOMER — a third population, alongside affiliate
// `users` and broker `broker_clients`. Never share a session or a guard with
// either (CLAUDE.md, "Two platforms in one repo").
//
// Why this table exists rather than a `customers` table: the paying customers
// are ALREADY in the database as `whop_customers`, written by the Whop webhook
// and sync. Duplicating them here would create two records that disagree the
// first time somebody changes their email in Whop. So this table holds only
// the things Whop does not give us — a password and a session identity — and
// joins to the real customer record on `whopUserId`.
//
// It is therefore legitimate for a paying customer to have NO row here: it
// means they have bought the indicator but never set up portal access.
export const customerAccountStatusEnum = pgEnum("customer_account_status", [
  "pending_email",
  "active",
  "suspended",
]);

export const customerAccountsTable = pgTable("customer_accounts", {
  id: serial("id").primaryKey(),
  // Joins to whop_customers.whop_user_id. Not a DB-level foreign key: the Whop
  // sync can create an account row before the customer record lands, and a
  // hard FK would make that ordering a 500 instead of a retry.
  whopUserId: text("whop_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  // Null until the customer verifies their email and chooses a password.
  passwordHash: text("password_hash"),
  fullName: text("full_name"),
  status: customerAccountStatusEnum("status").notNull().default("pending_email"),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomerAccountSchema = createInsertSchema(customerAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomerAccount = z.infer<typeof insertCustomerAccountSchema>;
export type CustomerAccount = typeof customerAccountsTable.$inferSelect;
