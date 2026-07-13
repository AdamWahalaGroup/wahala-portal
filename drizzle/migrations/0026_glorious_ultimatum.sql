CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_key` text NOT NULL,
	`trigger` text DEFAULT 'user' NOT NULL,
	`deal_id` text,
	`contact_id` text,
	`organization_id` text,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_cents` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_runs_deal_idx` ON `ai_runs` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ai_runs_agent_idx` ON `ai_runs` (`agent_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`organization_id` text,
	`agent_key` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by_user_id` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `suggestions_deal_idx` ON `suggestions` (`deal_id`,`status`);--> statement-breakpoint
ALTER TABLE `deals` ADD `fit_score` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `fit_rationale_md` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `fit_scored_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `priority_score` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `agent_spend_cents` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `meetings` ADD `reschedule_count` integer DEFAULT 0 NOT NULL;