ALTER TABLE `deal_calls` ADD `discovery_analysis` text;--> statement-breakpoint
ALTER TABLE `deal_calls` ADD `review_status` text DEFAULT 'applied' NOT NULL;--> statement-breakpoint
ALTER TABLE `deal_calls` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `deal_calls` ADD `reviewed_at` integer;
