import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const brokerClientSessionsTable = pgTable("broker_client_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: integer("client_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BrokerClientSession = typeof brokerClientSessionsTable.$inferSelect;
