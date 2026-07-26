CREATE TABLE `procurement_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`stage` text DEFAULT 'brief' NOT NULL,
	`language` text DEFAULT 'unknown' NOT NULL,
	`selected_supplier` text NOT NULL,
	`buyer_transcript` text DEFAULT '' NOT NULL,
	`supplier_transcript` text DEFAULT '' NOT NULL,
	`requirement_json` text,
	`offer_json` text,
	`decision_json` text,
	`purchase_order_json` text,
	`evidence_json` text,
	`fallback_used` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
