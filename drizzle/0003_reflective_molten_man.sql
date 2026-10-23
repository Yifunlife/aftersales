CREATE TABLE `staff_files` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
