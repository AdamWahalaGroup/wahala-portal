CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`deal_id` text,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'needed' NOT NULL,
	`signed_at` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agreements_org_idx` ON `agreements` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agreements_deal_idx` ON `agreements` (`deal_id`);--> statement-breakpoint
CREATE TABLE `contact_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contact_assets_contact_idx` ON `contact_assets` (`contact_id`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `organization_id` text REFERENCES organizations(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `state` text DEFAULT 'qualified' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `source` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `company_note` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `est_value_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `assigned_to_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `created_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `ai_analysis_md` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `ai_score` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD `ai_verdict` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `ai_analyzed_at` integer;--> statement-breakpoint
CREATE INDEX `contacts_state_idx` ON `contacts` (`state`);--> statement-breakpoint
CREATE INDEX `contacts_org_idx` ON `contacts` (`organization_id`);--> statement-breakpoint
ALTER TABLE `deals` ADD `origin` text DEFAULT 'qualified_from_triage' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `sub_status` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `deposit_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `deposit_sent_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `deposit_paid_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `kind` text DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
-- ============ hand-written backfill (CRM restructure, frames 30–34) ============
-- 1) Log a migration disposition per deal BEFORE remapping stages.
INSERT INTO `audit_log` (`id`, `organization_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`)
SELECT lower(hex(randomblob(16))), `organization_id`, NULL, 'stage.migrated_5col', 'deal', `id`,
  json_object('from', `stage`, 'to', CASE `stage`
    WHEN 'business_requirements' THEN 'discovery'
    WHEN 'solution_design' THEN 'proposal_out'
    WHEN 'proposal' THEN 'proposal_out'
    WHEN 'negotiation' THEN 'negotiating'
    WHEN 'contract' THEN 'committed' END),
  unixepoch()
FROM `deals`
WHERE `stage` IN ('business_requirements', 'solution_design', 'proposal', 'negotiation', 'contract');--> statement-breakpoint
-- 2) Remap 7-stage deals onto the 5-column set.
UPDATE `deals` SET `stage` = CASE `stage`
  WHEN 'business_requirements' THEN 'discovery'
  WHEN 'solution_design' THEN 'proposal_out'
  WHEN 'proposal' THEN 'proposal_out'
  WHEN 'negotiation' THEN 'negotiating'
  WHEN 'contract' THEN 'committed'
  ELSE `stage` END
WHERE `stage` IN ('business_requirements', 'solution_design', 'proposal', 'negotiation', 'contract');--> statement-breakpoint
-- 3) Fold unqualified/disqualified leads into contacts (contact id = lead id).
INSERT OR IGNORE INTO `contacts` (`id`, `organization_id`, `name`, `email`, `phone`, `title`, `notes`, `state`, `source`, `company_note`, `est_value_cents`, `assigned_to_user_id`, `created_by_user_id`, `ai_analysis_md`, `ai_score`, `ai_verdict`, `ai_analyzed_at`, `created_at`, `updated_at`)
SELECT `id`, NULL, `name`, `email`, `phone`, NULL, `notes`,
  CASE `status` WHEN 'new' THEN 'to_qualify' ELSE 'passed' END,
  `source`, `company`, 0, `assigned_to_user_id`, `created_by_user_id`,
  `ai_analysis_md`, `ai_score`, `ai_verdict`, `ai_analyzed_at`, `created_at`, `updated_at`
FROM `leads` WHERE `status` IN ('new', 'disqualified');--> statement-breakpoint
-- 4) Qualified leads: carry scout/source data onto the contact the qualify created.
UPDATE `contacts` SET
  `source` = COALESCE(`source`, (SELECT l.`source` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1)),
  `company_note` = COALESCE(`company_note`, (SELECT l.`company` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1)),
  `ai_analysis_md` = COALESCE(`ai_analysis_md`, (SELECT l.`ai_analysis_md` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1)),
  `ai_score` = COALESCE(`ai_score`, (SELECT l.`ai_score` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1)),
  `ai_verdict` = COALESCE(`ai_verdict`, (SELECT l.`ai_verdict` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1)),
  `ai_analyzed_at` = COALESCE(`ai_analyzed_at`, (SELECT l.`ai_analyzed_at` FROM `leads` l JOIN `deals` d ON d.`source_lead_id` = l.`id` WHERE d.`primary_contact_id` = `contacts`.`id` LIMIT 1))
WHERE EXISTS (SELECT 1 FROM `deals` d WHERE d.`primary_contact_id` = `contacts`.`id` AND d.`source_lead_id` IS NOT NULL);--> statement-breakpoint
-- 5) Backfill contacts.organization_id from deals, then contact_companies.
UPDATE `contacts` SET `organization_id` =
  (SELECT d.`organization_id` FROM `deals` d WHERE d.`primary_contact_id` = `contacts`.`id` ORDER BY d.`created_at` LIMIT 1)
WHERE `organization_id` IS NULL
  AND EXISTS (SELECT 1 FROM `deals` d WHERE d.`primary_contact_id` = `contacts`.`id`);--> statement-breakpoint
UPDATE `contacts` SET `organization_id` =
  (SELECT cc.`organization_id` FROM `contact_companies` cc WHERE cc.`contact_id` = `contacts`.`id` AND cc.`current` = 1 ORDER BY cc.`is_primary` DESC, cc.`created_at` LIMIT 1)
WHERE `organization_id` IS NULL
  AND EXISTS (SELECT 1 FROM `contact_companies` cc WHERE cc.`contact_id` = `contacts`.`id`);--> statement-breakpoint
-- 6) Copy lead files to contact_assets (triage rows share the id; qualified map via deals).
INSERT OR IGNORE INTO `contact_assets` (`id`, `contact_id`, `file_name`, `r2_key`, `mime_type`, `size_bytes`, `uploaded_by_user_id`, `created_at`)
SELECT la.`id`,
  COALESCE((SELECT d.`primary_contact_id` FROM `deals` d WHERE d.`source_lead_id` = la.`lead_id` LIMIT 1), la.`lead_id`),
  la.`file_name`, la.`r2_key`, la.`mime_type`, la.`size_bytes`, la.`uploaded_by_user_id`, la.`created_at`
FROM `lead_assets` la
WHERE EXISTS (SELECT 1 FROM `contacts` c WHERE c.`id` = COALESCE((SELECT d.`primary_contact_id` FROM `deals` d WHERE d.`source_lead_id` = la.`lead_id` LIMIT 1), la.`lead_id`));--> statement-breakpoint
-- 7) contract_items graduate into agreements (MSA/NDA read account-wide by the service).
INSERT OR IGNORE INTO `agreements` (`id`, `organization_id`, `deal_id`, `kind`, `label`, `status`, `signed_at`, `note`, `created_at`, `updated_at`)
SELECT `id`, `organization_id`, `deal_id`, `kind`, `label`,
  CASE `status` WHEN 'signed' THEN 'signed' ELSE 'needed' END,
  `signed_at`, `note`, `created_at`, `updated_at`
FROM `contract_items`;
