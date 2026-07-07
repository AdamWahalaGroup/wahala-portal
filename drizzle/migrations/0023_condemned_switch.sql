ALTER TABLE `proposal_options` ADD `phases` text;--> statement-breakpoint
ALTER TABLE `proposal_options` ADD `recommended` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `proposals` ADD `approvers` text;--> statement-breakpoint
ALTER TABLE `proposals` ADD `contract` text;