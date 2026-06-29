-- Phase 0 seed — minimum to exercise login + the scoped-query layer.
--   • one client org (Acme Corp), with its Account Owner assigned + accepted
--   • one Wahala staff admin (no org)  → logs in, sees all orgs + internal rows
--   • one test client user (Acme)      → logs in, sees only Acme + client-visible rows
--   • one project + two tasks (one client-visible, one internal) to prove visibility
--
-- Idempotent via fixed ids + INSERT OR IGNORE. Apply with:
--   npm run db:seed:local   (then db:seed:remote for production)

-- Order matters: users.organization_id has a FK to organizations, so the org row
-- must exist first. organizations.account_owner_user_id has NO FK, so pointing it
-- at the staff user before that user exists is fine.
INSERT OR IGNORE INTO organizations
  (id, name, slug, status, account_owner_user_id, owner_assigned_at, owner_accepted_at, created_at, updated_at)
VALUES
  ('org_acme_0001', 'Acme Corp', 'acme', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch(), unixepoch(), unixepoch());

INSERT OR IGNORE INTO users
  (id, organization_id, user_type, role, name, email, status, created_at)
VALUES
  ('usr_staff_admin_0001', NULL, 'wahala', 'wahala_admin', 'Adam (Wahala)', 'beachme785@gmail.com', 'active', unixepoch()),
  ('usr_client_admin_0001', 'org_acme_0001', 'client', 'client_admin', 'Acme Admin', 'client@acme.test', 'invited', unixepoch());

INSERT OR IGNORE INTO projects
  (id, organization_id, name, description, work_type, status, lead_engineer_user_id, created_at, updated_at)
VALUES
  ('prj_acme_0001', 'org_acme_0001', 'Acme Website Revamp', 'Initial engagement', 'software', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch());

INSERT OR IGNORE INTO tasks
  (id, organization_id, project_id, title, status, visibility, ai_assisted, created_by_user_id, created_at, updated_at)
VALUES
  ('tsk_acme_visible_0001', 'org_acme_0001', 'prj_acme_0001', 'Design homepage', 'in_progress', 'client_visible', 0, 'usr_staff_admin_0001', unixepoch(), unixepoch()),
  ('tsk_acme_internal_0001', 'org_acme_0001', 'prj_acme_0001', 'Internal: margin & staffing review', 'todo', 'internal', 0, 'usr_staff_admin_0001', unixepoch(), unixepoch());

-- ── Isolation fixtures ────────────────────────────────────────────────────────
-- A SECOND org (Beta) + its client, and a Wahala ENGINEER assigned to Acme ONLY.
-- These exercise: cross-tenant denial (client B vs Acme) and project-scoped staff
-- (the engineer sees Acme, never Beta).

INSERT OR IGNORE INTO organizations
  (id, name, slug, status, account_owner_user_id, owner_assigned_at, owner_accepted_at, created_at, updated_at)
VALUES
  ('org_beta_0001', 'Beta Corp', 'beta', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch(), unixepoch(), unixepoch());

INSERT OR IGNORE INTO users
  (id, organization_id, user_type, role, name, email, status, created_at)
VALUES
  ('usr_engineer_0001', NULL, 'wahala', 'engineer', 'Eng (Wahala)', 'eng@wahala.test', 'active', unixepoch()),
  ('usr_client_beta_0001', 'org_beta_0001', 'client', 'client_admin', 'Beta Admin', 'clientb@beta.test', 'invited', unixepoch());

INSERT OR IGNORE INTO projects
  (id, organization_id, name, description, work_type, status, lead_engineer_user_id, created_at, updated_at)
VALUES
  ('prj_beta_0001', 'org_beta_0001', 'Beta Mobile App', 'Initial engagement', 'software', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch());

-- Engineer is on the Acme roster only (NOT Beta) → must see Acme, never Beta.
INSERT OR IGNORE INTO project_members
  (id, organization_id, project_id, user_id, project_role, created_at)
VALUES
  ('pm_acme_eng_0001', 'org_acme_0001', 'prj_acme_0001', 'usr_engineer_0001', 'engineer', unixepoch());
