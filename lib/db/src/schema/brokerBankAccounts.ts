import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Client-owned payout destinations. Soft-deleted (deletedAt) because past
// withdrawals reference them and the audit trail must survive removal.
export const brokerBankAccountsTable = pgTable(
  "broker_bank_accounts",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    beneficiaryName: text("beneficiary_name").notNull(),
    bankName: text("bank_name").notNull(),
    iban: text("iban"),
    accountNumber: text("account_number"),
    swift: text("swift"),
    currency: text("currency").notNull().default("USD"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("broker_bank_accounts_client_idx").on(table.clientId)]
);

export const insertBrokerBankAccountSchema = createInsertSchema(brokerBankAccountsTable).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertBrokerBankAccount = z.infer<typeof insertBrokerBankAccountSchema>;
export type BrokerBankAccount = typeof brokerBankAccountsTable.$inferSelect;
