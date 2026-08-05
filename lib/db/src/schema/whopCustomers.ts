import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whopCustomersTable = pgTable("whop_customers", {
  id: serial("id").primaryKey(),
  whopUserId: text("whop_user_id").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  country: text("country"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWhopCustomerSchema = createInsertSchema(whopCustomersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWhopCustomer = z.infer<typeof insertWhopCustomerSchema>;
export type WhopCustomer = typeof whopCustomersTable.$inferSelect;
