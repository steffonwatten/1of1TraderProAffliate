import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

// One USD wallet per client. `balance` is numeric and Drizzle returns it as a
// string — keep it a string; all arithmetic goes through the integer-cents
// helpers in api-server's brokerLedger. INVARIANT: balance changes only inside
// the same db.transaction() that inserts or transitions a broker_transactions
// row. Never update it on its own.
export const brokerWalletsTable = pgTable("broker_wallets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  currency: text("currency").notNull().default("USD"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BrokerWallet = typeof brokerWalletsTable.$inferSelect;
