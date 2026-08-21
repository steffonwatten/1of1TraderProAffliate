import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// Sessions for indicator customers. Deliberately a separate table from
// `user_sessions` (affiliate/admin) and `broker_client_sessions` (trading
// clients) so a token from one population can never resolve in another.
export const customerSessionsTable = pgTable("customer_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  customerAccountId: integer("customer_account_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CustomerSession = typeof customerSessionsTable.$inferSelect;
