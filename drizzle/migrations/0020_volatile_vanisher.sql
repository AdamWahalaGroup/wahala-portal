CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`zoom_meeting_id` text NOT NULL,
	`organization_id` text,
	`deal_id` text,
	`topic` text NOT NULL,
	`join_url` text,
	`start_url` text,
	`scheduled_by_user_id` text,
	`starts_at` integer,
	`duration_min` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`transcript_md` text,
	`call_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scheduled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_zoom_meeting_id_unique` ON `meetings` (`zoom_meeting_id`);--> statement-breakpoint
CREATE INDEX `meetings_deal_idx` ON `meetings` (`deal_id`);--> statement-breakpoint
CREATE INDEX `meetings_status_idx` ON `meetings` (`status`);--> statement-breakpoint
CREATE TABLE `user_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`email` text,
	`refresh_token` text NOT NULL,
	`access_token` text,
	`access_token_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_integrations_user_provider_idx` ON `user_integrations` (`user_id`,`provider`);