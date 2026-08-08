import { pgTable, serial, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const brokerTradingAccountStatusEnum = pgEnum("broker_trading_account_status", [
  "active",
  "archived",
]);

// Balance/equity are deliberately NOT stored here — they live in MT5 and are
// fetched through the @workspace/mt5 adapter on read. Storing them would rot.
export const brokerTradingAccountsTable = pgTable(
  "broker_trading_accounts",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    mt5Login: text("mt5_login").notNull().unique(),
    accountTypeId: integer("account_type_id").notNull(),
    leverage: integer("leverage").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: brokerTradingAccountStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("broker_trading_accounts_client_idx").on(table.clientId)]
);

export type BrokerTradingAccount = typeof brokerTradingAccountsTable.$inferSelect;
