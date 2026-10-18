-- Rebuild identifiers as nullable while preserving child sessions under D1 foreign-key enforcement.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__session_backup` (
 `token` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `version` integer NOT NULL,
 `expires` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `__session_backup` SELECT `token`,`user_id`,`version`,`expires` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`email` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	`hash` text NOT NULL,
	`salt` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_employees`("id", "employee_id", "email", "name", "role", "active", "must_change", "hash", "salt", "version", "created_at", "updated_at") SELECT "id", "employee_id", "email", "name", "role", "active", "must_change", "hash", "salt", "version", "created_at", "updated_at" FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
CREATE UNIQUE INDEX `employee_id_unique` ON `employees` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_email_unique` ON `employees` (`email`);
--> statement-breakpoint
CREATE TABLE `sessions` (
 `token` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `version` integer NOT NULL,
 `expires` integer NOT NULL,
 FOREIGN KEY (`user_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `sessions` SELECT `token`,`user_id`,`version`,`expires` FROM `__session_backup`;--> statement-breakpoint
DROP TABLE `__session_backup`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
