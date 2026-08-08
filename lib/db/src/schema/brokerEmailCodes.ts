import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

// Verification codes are stored hashed (SHA-256 of the 6-digit code) so a DB
// read alone cannot verify an account. `setPasswordToken` is issued once the
// code is consumed and authorizes exactly one set-password call.
export const brokerEmailCodesTable = pgTable(
  "broker_email_codes",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    clientId: integer("client_id"),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose").notNull().default("verify_email"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    setPasswordToken: text("set_password_token").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("broker_email_codes_email_idx").on(table.email)]
);

export type BrokerEmailCode = typeof brokerEmailCodesTable.$inferSelect;
