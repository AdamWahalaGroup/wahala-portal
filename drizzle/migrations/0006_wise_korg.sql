CREATE TABLE `deliverable_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_line_item_id` text NOT NULL,
	`author_user_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`stage_line_item_id`) REFERENCES `stage_line_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deliverable_notes_item_idx` ON `deliverable_notes` (`stage_line_item_id`);--> statement-breakpoint
ALTER TABLE `stage_line_items` ADD `completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stage_line_items` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `stage_line_items` ADD `completed_by_user_id` text REFERENCES users(id);