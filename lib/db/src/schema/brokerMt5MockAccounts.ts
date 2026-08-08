import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

// Backing store for @workspace/mt5's MockMt5Provider ONLY. Simulates the MT5
// server's own account state so mock balances survive restarts. The real
// ManagerMt5Provider never touches this table — it can be dropped once the
// live MT5 Manager API is configured.
export const brokerMt5MockAccountsTable = pgTable("broker_mt5_mock_accounts", {
  login: text("login").primaryKey(),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  currency: text("currency").notNull().default("USD"),
  leverage: integer("leverage").notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BrokerMt5MockAccount = typeof brokerMt5MockAccountsTable.$inferSelect;
