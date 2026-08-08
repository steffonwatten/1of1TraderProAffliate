import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Trading clients are a separate population from the affiliate `users` table —
// they authenticate independently and must never share sessions or roles.
export const brokerClientStatusEnum = pgEnum("broker_client_status", [
  "pending_email",
  "active",
  "suspended",
]);

export const brokerKycStatusEnum = pgEnum("broker_kyc_status", [
  "none",
  "pending",
  "approved",
  "rejected",
]);

export const brokerClientsTable = pgTable("broker_clients", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Null until the client verifies their email and sets a password.
  passwordHash: text("password_hash"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  country: text("country"),
  status: brokerClientStatusEnum("status").notNull().default("pending_email"),
  emailVerifiedAt: timestamp("email_verified_at"),
  kycStatus: brokerKycStatusEnum("kyc_status").notNull().default("none"),
  kycNotes: text("kyc_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertBrokerClientSchema = createInsertSchema(brokerClientsTable).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});
export type InsertBrokerClient = z.infer<typeof insertBrokerClientSchema>;
export type BrokerClient = typeof brokerClientsTable.$inferSelect;
