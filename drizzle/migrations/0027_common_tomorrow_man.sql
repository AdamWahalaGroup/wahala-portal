ALTER TABLE `deals` ADD `engagement_type` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `delivery_model` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `ip_disposition` text DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `data_sensitivity` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `support_expectation` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `expected_close_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `next_action_due_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `next_action_court` text DEFAULT 'wahala' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `champion` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `economic_buyer` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `compelling_event` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `decision_process` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `budget_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `budget_evidence` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `engagement_health_score` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `action_urgency_score` real;