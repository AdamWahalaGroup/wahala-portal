CREATE TABLE `lead_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lead_assets_lead_idx` ON `lead_assets` (`lead_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_analysis_md` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_score` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_verdict` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_analyzed_at` integer;