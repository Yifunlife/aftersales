CREATE TABLE `customer_files` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `customer_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_invite_token_unique` ON `customer_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text,
	`company` text NOT NULL,
	`contact` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`country` text NOT NULL,
	`language` text NOT NULL,
	`sales_owner` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_market_id_unique` ON `customer_profiles` (`market_id`);--> statement-breakpoint
CREATE TABLE `customer_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`store_id` text NOT NULL,
	`invite_id` text NOT NULL,
	`submission_key` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`note` text NOT NULL,
	`reviewer_id` text,
	`checked_by` text,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `customer_stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invite_id`) REFERENCES `customer_invites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_request_submission_unique` ON `customer_requests` (`invite_id`,`submission_key`);--> statement-breakpoint
CREATE TABLE `customer_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`market_id` text,
	`name` text NOT NULL,
	`order_no` text NOT NULL,
	`address` text NOT NULL,
	`contact` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_market_id_unique` ON `customer_stores` (`market_id`);--> statement-breakpoint
CREATE TABLE `customer_work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `customer_requests`(`id`) ON UPDATE no action ON DELETE no action
);
