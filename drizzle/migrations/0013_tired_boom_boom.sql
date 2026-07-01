CREATE TABLE `proposal_options` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`summary_md` text NOT NULL,
	`timeline_note` text,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`price_note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposal_options_proposal_idx` ON `proposal_options` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`executive_summary_md` text,
	`assumptions_md` text,
	`complexity_score` integer,
	`complexity_rationale` text,
	`share_token` text,
	`sent_at` integer,
	`responded_at` integer,
	`responded_by_name` text,
	`response_note` text,
	`selected_option_id` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_share_token_unique` ON `proposals` (`share_token`);--> statement-breakpoint
CREATE INDEX `proposals_deal_idx` ON `proposals` (`deal_id`);