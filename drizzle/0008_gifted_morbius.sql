CREATE TABLE `analysis_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analysis_reports` (
	`month` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assistant_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_hash` text NOT NULL,
	`audience` text NOT NULL,
	`channel` text NOT NULL,
	`topic` text NOT NULL,
	`question` text NOT NULL,
	`mode` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`feedback` text DEFAULT 'unknown' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_event_time` ON `assistant_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `improvement_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`keyword` text NOT NULL,
	`description` text NOT NULL,
	`scope` text NOT NULL,
	`owner` text NOT NULL,
	`implemented_at` integer NOT NULL,
	`window_days` integer NOT NULL,
	`before_devices` integer DEFAULT 0 NOT NULL,
	`after_devices` integer DEFAULT 0 NOT NULL,
	`conclusion` text DEFAULT 'observing' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `improvement_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`day` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `improvement_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO analysis_meta(key,value) VALUES('tracking_started_at',CAST(CAST(strftime('%s','now') AS INTEGER)*1000 AS TEXT));
