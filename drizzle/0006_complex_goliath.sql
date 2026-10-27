CREATE TABLE `knowledge_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`note_key` text NOT NULL,
	`files` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`result_key` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
