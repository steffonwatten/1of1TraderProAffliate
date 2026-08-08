import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// Key-value store for broker configuration that is NOT secret: wire transfer
// details shown to depositing clients (`wire_details`) and static crypto
// deposit addresses (`crypto_addresses`). Values are Zod-validated per key in
// the admin settings route before writing. Secrets never go here.
export const brokerSettingsTable = pgTable("broker_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BrokerSetting = typeof brokerSettingsTable.$inferSelect;
