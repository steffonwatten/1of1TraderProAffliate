import { pgTable, serial, text, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Admin-managed catalog of account offerings (e.g. Standard / Pro).
// `leverages` is a JSON array of allowed leverage multipliers, e.g. [100,200,400].
export const brokerAccountTypesTable = pgTable("broker_account_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // MT5 server-side group the account is provisioned into.
  mt5Group: text("mt5_group").notNull(),
  currency: text("currency").notNull().default("USD"),
  minDeposit: numeric("min_deposit", { precision: 14, scale: 2 }).notNull().default("0"),
  leverages: jsonb("leverages").notNull().$type<number[]>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBrokerAccountTypeSchema = createInsertSchema(brokerAccountTypesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBrokerAccountType = z.infer<typeof insertBrokerAccountTypeSchema>;
export type BrokerAccountType = typeof brokerAccountTypesTable.$inferSelect;
