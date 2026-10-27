CREATE TABLE `staff_work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_date` text NOT NULL,
	`reference` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_payment_work` ON `work_payments` (`work_id`);