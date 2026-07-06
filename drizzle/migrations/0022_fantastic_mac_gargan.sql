CREATE TABLE `meeting_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`google_event_id` text,
	`recurring_event_id` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meeting_suppressions_event_idx` ON `meeting_suppressions` (`google_event_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`google_event_id` text,
	`google_calendar_id` text,
	`zoom_meeting_id` text,
	`organization_id` text,
	`deal_id` text,
	`project_id` text,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`attendees` text,
	`video_url` text,
	`video_provider` text,
	`start_url` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`suggested_organization_id` text,
	`suggestion_reason` text,
	`transcript_md` text,
	`call_id` text,
	`created_by_user_id` text,
	`synced_by_user_id` text,
	`source` text DEFAULT 'google' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`synced_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_google_event_id_unique` ON `meetings` (`google_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_zoom_meeting_id_unique` ON `meetings` (`zoom_meeting_id`);--> statement-breakpoint
CREATE INDEX `meetings_deal_idx` ON `meetings` (`deal_id`);--> statement-breakpoint
CREATE INDEX `meetings_org_idx` ON `meetings` (`organization_id`);--> statement-breakpoint
CREATE INDEX `meetings_status_idx` ON `meetings` (`status`);--> statement-breakpoint
CREATE INDEX `meetings_starts_idx` ON `meetings` (`starts_at`);