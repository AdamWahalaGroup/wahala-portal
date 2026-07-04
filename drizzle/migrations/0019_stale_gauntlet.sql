CREATE TABLE `deal_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`title` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`duration_min` integer,
	`transcript_md` text NOT NULL,
	`fields_extracted` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deal_calls_deal_idx` ON `deal_calls` (`deal_id`);--> statement-breakpoint
CREATE TABLE `discovery_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`fields` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_packages_deal_id_unique` ON `discovery_packages` (`deal_id`);--> statement-breakpoint
CREATE INDEX `discovery_packages_deal_idx` ON `discovery_packages` (`deal_id`);--> statement-breakpoint
CREATE TABLE `process_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`owner_user_id` text,
	`actor_user_id` text,
	`kind` text NOT NULL,
	`from_step` text,
	`to_step` text,
	`readiness_score` real,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `process_events_deal_idx` ON `process_events` (`deal_id`);--> statement-breakpoint
CREATE INDEX `process_events_owner_idx` ON `process_events` (`owner_user_id`,`kind`);--> statement-breakpoint
ALTER TABLE `deals` ADD `readiness_score` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `post_mortem_md` text;--> statement-breakpoint
ALTER TABLE `users` ADD `training_mode` integer DEFAULT false NOT NULL;