import { pgTable, serial, text, timestamp, integer, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brokerTxTypeEnum = pgEnum("broker_tx_type", [
  "deposit_wire",
  "deposit_crypto",
  "withdrawal",
  "transfer_to_mt5",
  "transfer_from_mt5",
  "adjustment",
]);

export const brokerTxStatusEnum = pgEnum("broker_tx_status", [
  "pending",
  "approved",
  "rejected",
  "failed",
]);

// Single append-only ledger for every money movement. `amount` is always
// positive — direction comes from `type`. Rows are never deleted; a decision
// transitions status exactly once (UPDATEs guard status='pending').
export const brokerTransactionsTable = pgTable(
  "broker_transactions",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    walletId: integer("wallet_id").notNull(),
    type: brokerTxTypeEnum("type").notNull(),
    status: brokerTxStatusEnum("status").notNull().default("pending"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    // Wire reference or free-form client-supplied identifier.
    reference: text("reference"),
    cryptoCoin: text("crypto_coin"),
    cryptoTxid: text("crypto_txid"),
    bankAccountId: integer("bank_account_id"),
    tradingAccountId: integer("trading_account_id"),
    mt5Ticket: text("mt5_ticket"),
    clientNote: text("client_note"),
    adminNotes: text("admin_notes"),
    decidedBy: integer("decided_by"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("broker_transactions_client_created_idx").on(table.clientId, table.createdAt),
    index("broker_transactions_status_type_idx").on(table.status, table.type),
  ]
);

export const insertBrokerTransactionSchema = createInsertSchema(brokerTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBrokerTransaction = z.infer<typeof insertBrokerTransactionSchema>;
export type BrokerTransaction = typeof brokerTransactionsTable.$inferSelect;
