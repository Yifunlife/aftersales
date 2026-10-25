ALTER TABLE `customer_invites` ADD `access_mode` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_invites` ADD `request_id` text;