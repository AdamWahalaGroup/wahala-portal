-- Opportunities restructure (HANDOFF-DELTA-2026-07-09):
--   · deals / proposals / process_events / audit_log lose NOT NULL on organization_id
--     (an opportunity hangs on a CONTACT; the account is born at Create project →)
--   · every to_qualify contact converts into a deal at stage 'new' (the New column)
--
-- SQLite can't ALTER a NOT NULL away, and the usual create-copy-drop-rename dance
-- poisons the deferred-FK counter (dropping a parent with live child rows counts
-- violations that a rename never clears — commit fails even though the end state
-- is consistent). So: stash every child table's rows in plain _mig_* tables, empty
-- them, drop tables child-first, recreate under their final names, refill in
-- dependency order. The counter stays at zero throughout.
PRAGMA defer_foreign_keys = true;--> statement-breakpoint

-- 1 · Stash everything that references deals/proposals (or is being rebuilt).
CREATE TABLE `_mig_proposal_options` AS SELECT * FROM `proposal_options`;--> statement-breakpoint
CREATE TABLE `_mig_contract_items` AS SELECT * FROM `contract_items`;--> statement-breakpoint
CREATE TABLE `_mig_agreements` AS SELECT * FROM `agreements`;--> statement-breakpoint
CREATE TABLE `_mig_deal_calls` AS SELECT * FROM `deal_calls`;--> statement-breakpoint
CREATE TABLE `_mig_discovery_packages` AS SELECT * FROM `discovery_packages`;--> statement-breakpoint
CREATE TABLE `_mig_meetings` AS SELECT * FROM `meetings`;--> statement-breakpoint
CREATE TABLE `_mig_proposals` AS SELECT * FROM `proposals`;--> statement-breakpoint
CREATE TABLE `_mig_process_events` AS SELECT * FROM `process_events`;--> statement-breakpoint
CREATE TABLE `_mig_audit_log` AS SELECT * FROM `audit_log`;--> statement-breakpoint
CREATE TABLE `_mig_deals` AS SELECT * FROM `deals`;--> statement-breakpoint

-- 2 · Empty the children we keep (child-row deletes are always FK-safe)…
DELETE FROM `proposal_options`;--> statement-breakpoint
DELETE FROM `contract_items`;--> statement-breakpoint
DELETE FROM `agreements`;--> statement-breakpoint
DELETE FROM `deal_calls`;--> statement-breakpoint
DELETE FROM `discovery_packages`;--> statement-breakpoint
DELETE FROM `meetings`;--> statement-breakpoint

-- …and drop the rebuilt tables child-first (each is empty of children by now).
DROP TABLE `proposals`;--> statement-breakpoint
DROP TABLE `process_events`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
DROP TABLE `deals`;--> statement-breakpoint

-- 3 · Recreate under final names, organization_id now nullable.
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`stage` text DEFAULT 'discovery' NOT NULL,
	`stage_entered_at` integer NOT NULL,
	`owner_user_id` text,
	`primary_contact_id` text,
	`source_lead_id` text,
	`origin` text DEFAULT 'qualified_from_triage' NOT NULL,
	`sub_status` text,
	`deposit_cents` integer DEFAULT 0 NOT NULL,
	`deposit_sent_at` integer,
	`deposit_paid_at` integer,
	`readiness_score` real,
	`post_mortem_md` text,
	`value_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`discovery_md` text,
	`discovery_note` text,
	`project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `deals_org_idx` ON `deals` (`organization_id`);--> statement-breakpoint
CREATE INDEX `deals_stage_idx` ON `deals` (`stage`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
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
	`approvers` text,
	`contract` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_share_token_unique` ON `proposals` (`share_token`);--> statement-breakpoint
CREATE INDEX `proposals_deal_idx` ON `proposals` (`deal_id`);--> statement-breakpoint
CREATE TABLE `process_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
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
);--> statement-breakpoint
CREATE INDEX `process_events_deal_idx` ON `process_events` (`deal_id`);--> statement-breakpoint
CREATE INDEX `process_events_owner_idx` ON `process_events` (`owner_user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- 4 · Refill in dependency order (parents first — the counter never moves).
INSERT INTO `deals` ("id", "organization_id", "name", "stage", "stage_entered_at", "owner_user_id", "primary_contact_id", "source_lead_id", "origin", "sub_status", "deposit_cents", "deposit_sent_at", "deposit_paid_at", "readiness_score", "post_mortem_md", "value_cents", "notes", "discovery_md", "discovery_note", "project_id", "created_at", "updated_at")
SELECT "id", "organization_id", "name", "stage", "stage_entered_at", "owner_user_id", "primary_contact_id", "source_lead_id", "origin", "sub_status", "deposit_cents", "deposit_sent_at", "deposit_paid_at", "readiness_score", "post_mortem_md", "value_cents", "notes", "discovery_md", "discovery_note", "project_id", "created_at", "updated_at" FROM `_mig_deals`;--> statement-breakpoint
INSERT INTO `proposals` ("id", "organization_id", "deal_id", "version", "status", "title", "executive_summary_md", "assumptions_md", "complexity_score", "complexity_rationale", "share_token", "sent_at", "responded_at", "responded_by_name", "response_note", "selected_option_id", "approvers", "contract", "created_by_user_id", "created_at", "updated_at")
SELECT "id", "organization_id", "deal_id", "version", "status", "title", "executive_summary_md", "assumptions_md", "complexity_score", "complexity_rationale", "share_token", "sent_at", "responded_at", "responded_by_name", "response_note", "selected_option_id", "approvers", "contract", "created_by_user_id", "created_at", "updated_at" FROM `_mig_proposals`;--> statement-breakpoint
INSERT INTO `process_events` ("id", "organization_id", "deal_id", "owner_user_id", "actor_user_id", "kind", "from_step", "to_step", "readiness_score", "metadata", "created_at")
SELECT "id", "organization_id", "deal_id", "owner_user_id", "actor_user_id", "kind", "from_step", "to_step", "readiness_score", "metadata", "created_at" FROM `_mig_process_events`;--> statement-breakpoint
INSERT INTO `audit_log` ("id", "organization_id", "actor_user_id", "action", "entity_type", "entity_id", "metadata", "created_at")
SELECT "id", "organization_id", "actor_user_id", "action", "entity_type", "entity_id", "metadata", "created_at" FROM `_mig_audit_log`;--> statement-breakpoint
INSERT INTO `proposal_options` SELECT * FROM `_mig_proposal_options`;--> statement-breakpoint
INSERT INTO `contract_items` SELECT * FROM `_mig_contract_items`;--> statement-breakpoint
INSERT INTO `agreements` SELECT * FROM `_mig_agreements`;--> statement-breakpoint
INSERT INTO `deal_calls` SELECT * FROM `_mig_deal_calls`;--> statement-breakpoint
INSERT INTO `discovery_packages` SELECT * FROM `_mig_discovery_packages`;--> statement-breakpoint
INSERT INTO `meetings` SELECT * FROM `_mig_meetings`;--> statement-breakpoint

-- 5 · Drop the stash.
DROP TABLE `_mig_proposal_options`;--> statement-breakpoint
DROP TABLE `_mig_contract_items`;--> statement-breakpoint
DROP TABLE `_mig_agreements`;--> statement-breakpoint
DROP TABLE `_mig_deal_calls`;--> statement-breakpoint
DROP TABLE `_mig_discovery_packages`;--> statement-breakpoint
DROP TABLE `_mig_meetings`;--> statement-breakpoint
DROP TABLE `_mig_proposals`;--> statement-breakpoint
DROP TABLE `_mig_process_events`;--> statement-breakpoint
DROP TABLE `_mig_audit_log`;--> statement-breakpoint
DROP TABLE `_mig_deals`;--> statement-breakpoint

-- 6 · Convert every triage contact into an opportunity (deal at stage 'new') —
-- the same queue, the same data: est value, owner, and the intake note travel.
INSERT INTO `deals` ("id", "organization_id", "name", "stage", "stage_entered_at", "owner_user_id", "primary_contact_id", "origin", "value_cents", "notes", "discovery_note", "created_at", "updated_at")
SELECT lower(hex(randomblob(16))), c.organization_id,
  coalesce(o.name, c.name) || ' — opportunity',
  'new', unixepoch(), c.assigned_to_user_id, c.id, 'captured',
  coalesce(c.est_value_cents, 0), c.notes, c.notes, unixepoch(), unixepoch()
FROM `contacts` c LEFT JOIN `organizations` o ON o.id = c.organization_id
WHERE c.state = 'to_qualify';--> statement-breakpoint
UPDATE `contacts` SET `state` = 'qualified' WHERE `state` = 'to_qualify';
