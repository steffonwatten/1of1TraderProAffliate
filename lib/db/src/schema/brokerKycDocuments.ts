import { pgTable, serial, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brokerKycDocTypeEnum = pgEnum("broker_kyc_doc_type", [
  "id_front",
  "id_back",
  "proof_of_address",
]);

export const brokerKycDocStatusEnum = pgEnum("broker_kyc_doc_status", [
  "pending",
  "approved",
  "rejected",
]);

export const brokerKycDocumentsTable = pgTable(
  "broker_kyc_documents",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    docType: brokerKycDocTypeEnum("doc_type").notNull(),
    originalName: text("original_name").notNull(),
    // Path relative to KYC_UPLOAD_DIR — never a repo path, never committed.
    storedPath: text("stored_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: brokerKycDocStatusEnum("status").notNull().default("pending"),
    reviewNotes: text("review_notes"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("broker_kyc_documents_client_idx").on(table.clientId)]
);

export const insertBrokerKycDocumentSchema = createInsertSchema(brokerKycDocumentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBrokerKycDocument = z.infer<typeof insertBrokerKycDocumentSchema>;
export type BrokerKycDocument = typeof brokerKycDocumentsTable.$inferSelect;
