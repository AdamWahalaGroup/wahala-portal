DROP TABLE `meetings`;--> statement-breakpoint
ALTER TABLE `user_integrations` ADD `last_sync_at` integer;--> statement-breakpoint
ALTER TABLE `user_integrations` ADD `disconnected_at` integer;