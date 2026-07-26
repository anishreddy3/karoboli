import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const procurementCases = sqliteTable(
  "procurement_cases",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    stage: text("stage").notNull().default("brief"),
    language: text("language").notNull().default("unknown"),
    selectedSupplier: text("selected_supplier").notNull(),
    buyerTranscript: text("buyer_transcript").notNull().default(""),
    supplierTranscript: text("supplier_transcript").notNull().default(""),
    requirementJson: text("requirement_json"),
    offerJson: text("offer_json"),
    decisionJson: text("decision_json"),
    purchaseOrderJson: text("purchase_order_json"),
    evidenceJson: text("evidence_json"),
    fallbackUsed: integer("fallback_used", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("procurement_cases_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt,
    ),
  ],
);
