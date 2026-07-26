ALTER TABLE `procurement_cases` ADD `buyer_english_transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `procurement_cases` ADD `supplier_english_transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `procurement_cases` ADD `seller_brief_language` text DEFAULT 'en-IN' NOT NULL;