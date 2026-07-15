/**
 * Wahala Portal — database schema (Cloudflare D1 / SQLite via Drizzle).
 *
 * Encodes the operating model in docs/OPERATING-MODEL.md. Key decisions baked in:
 *  - Delivery PHASES (stored in `stages`) are the billable spine.
 *  - INVARIANT (enforced in the service layer): each billing mode has an
 *    explicit payment boundary. Upfront work cannot start unpaid; on-delivery
 *    work cannot be accepted unpaid.
 *  - Project → Stages (client pays per stage) → Tasks (internal work).
 *  - Account Owner (relationship) + Lead Engineer (delivery); roster scales 1..N.
 *  - Tasks are client-visible by default; assignees may be a Wahala engineer OR a
 *    client (an "on you" action item), and later an AI worker.
 *  - Assets carry a visibility flag; recordings + AI analyses are internal-only.
 */
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  BUDGET_STATUSES,
  DATA_SENSITIVITIES,
  DELIVERY_MODELS,
  ENGAGEMENT_TYPES,
  IP_DISPOSITIONS,
  NEXT_ACTION_COURTS,
} from "../domain/deal-operating-model";
import { PACKAGE_FIELDS } from "../domain/process";
import { DISCOVERY_REVIEW_STATUSES } from "../domain/discovery-review";

// ---- shared column helpers ----
const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// ---- enums (SQLite stores as text) ----
export const USER_TYPES = ["wahala", "client"] as const;
export const USER_ROLES = [
  "wahala_admin",
  "sales_rep",
  "account_owner",
  "lead_engineer",
  "engineer",
  "client_admin",
  "client_user",
  "client_billing",
  "client_readonly",
] as const;
export const STAGE_STATUSES = [
  "draft",
  "quoted",
  "approved",
  "paid",
  "in_progress",
  "delivered",
  "accepted",
  "needs_revision",
  "rejected",
] as const;
export const VISIBILITY = ["client_visible", "internal"] as const;
export const BILLING_MODES = ["upfront", "on_delivery"] as const;
export const LEAD_STATUSES = ["new", "qualified", "disqualified"] as const;
// CRM model (docs/OPERATING-MODEL.md): a person is
// one Contact record forever — "lead" is the to_qualify STATE, not a thing. Passed
// contacts are kept and searchable, never deleted.
export const CONTACT_STATES = ["to_qualify", "qualified", "passed"] as const;
// Sales STAGES are dispositions, not a state machine: free to skip, free to move,
// never enforced (see docs/OPERATING-MODEL.md — enforce gates, report on
// stages"). won/lost are terminal dispositions kept out of the funnel columns.
// OPPORTUNITIES RESTRUCTURE (2026-07-09): an opportunity is not a new object — it
// is the deal record at stage 'new'. Triage (contacts-as-column) is retired; the
// board is New → Discovery → Proposal out → Negotiating → Committed.
export const DEAL_STAGES = [
  "new",
  "discovery",
  "proposal_out",
  "negotiating",
  "committed",
  "won",
  "lost",
] as const;
// How a deal came to exist — provenance for the sales⇄delivery loop.
export const DEAL_ORIGINS = [
  "captured",
  "qualified_from_triage",
  "bypass",
  "spawned_from_project",
] as const;
export const PROPOSAL_STATUSES = ["draft", "sent", "approved", "declined", "superseded"] as const;
export const CONTRACT_ITEM_KINDS = ["msa", "nda", "insurance", "other"] as const;
// Agreements replace contract_items: MSA/NDA live at the ACCOUNT level (deal_id kept
// only for provenance) so later deals skip legal and go proposal → SOW.
export const AGREEMENT_KINDS = [
  "msa",
  "nda",
  "commercial_agreement",
  "ip_schedule",
  "professional_services",
  "dpa",
  "security_addendum",
  "support_agreement",
  "licensing",
  "insurance",
  "other",
] as const;
export const AGREEMENT_STATUSES = ["needed", "sent", "signed", "n_a"] as const;
export const PROJECT_KINDS = ["standard", "paid_discovery"] as const;
// Process model (TRAINING-AND-SCORECARD.md): the 10 Discovery Package fields whose
// accepted evidence drives the deal's readiness score.
export { PACKAGE_FIELDS };
export const PACKAGE_FIELD_STATUSES = ["ok", "partial", "missing"] as const;
// Append-only process log — feeds the post-mortem + admin scorecard entirely.
export const PROCESS_EVENT_KINDS = [
  "stage_moved",
  "nudge_fired",
  "nudge_acted",
  "nudge_overridden",
  "call_ingested",
  "postmortem_created",
  // Manual package-field edit (kind column is plain TEXT in D1 — no migration).
  "field_edited",
] as const;

// ---- App settings (admin-tunable key/value; JSON values) ----
// Runtime configuration that shouldn't need a redeploy — e.g. per-AI-agent model +
// reasoning effort (`agent:<key>` rows). Read with env-var fallback.
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: updatedAt(),
});

// ---- Organizations (client companies = tenants) ----
export const organizations = sqliteTable("organizations", {
  id: pk(),
  name: text("name").notNull(), // we own organizations here (no external identity provider)
  slug: text("slug").unique(),
  status: text("status", { enum: ["prospect", "active", "archived"] })
    .notNull()
    .default("prospect"),
  // Free-text intake captured at onboarding: what the prospect is looking for.
  intakeNotes: text("intake_notes"),
  // Durable per-client markdown memory for AI features: grounds future drafts and is
  // appended to as projects are drafted. Editable by staff on the account hub.
  aiContextMd: text("ai_context_md"),
  // dedicated Account Owner ("throat to choke") — must accept before work begins
  accountOwnerUserId: text("account_owner_user_id"),
  ownerAssignedAt: integer("owner_assigned_at", { mode: "timestamp" }),
  ownerAcceptedAt: integer("owner_accepted_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---- Users (Wahala staff + client users; magic-link auth, identity = email) ----
export const users = sqliteTable(
  "users",
  {
    id: pk(),
    organizationId: text("organization_id").references(() => organizations.id), // null = Wahala staff
    userType: text("user_type", { enum: USER_TYPES }).notNull(),
    role: text("role", { enum: USER_ROLES }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(), // login identity (magic-link)
    status: text("status", { enum: ["invited", "active", "disabled"] })
      .notNull()
      .default("invited"),
    // Training mode (frame 38): guidance layer on + actions logged to the scorecard.
    // Self-toggleable; admins can set it for others. Staff invitations choose the
    // initial value deliberately; the database default remains off.
    trainingMode: integer("training_mode", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("users_org_idx").on(t.organizationId)],
);

// ---- Leads (CRM front half: an UNOWNED record trap) ----
// A lead is a name + number + context that must be able to exist without ownership.
// It means nothing until a salesperson qualifies it — qualification converts it into
// an organization (status 'prospect') + contact + deal.
export const leads = sqliteTable(
  "leads",
  {
    id: pk(),
    name: text("name").notNull(), // person or "guy from the airport bar"
    company: text("company"), // free text until qualified — no org row yet
    email: text("email"),
    phone: text("phone"),
    source: text("source"), // website form, referral, airport bar, Reddit…
    industry: text("industry"), // marketing vertical
    notes: text("notes"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id), // null = unowned
    createdByUserId: text("created_by_user_id").references(() => users.id),
    convertedDealId: text("converted_deal_id"), // set on qualify (no FK: deals is defined below)
    // The AI lead scout's take (expert opinion + web recon + associations), a rough
    // 1–10 effort-worthiness score, and a verdict. Regenerated on demand.
    aiAnalysisMd: text("ai_analysis_md"),
    aiScore: integer("ai_score"),
    aiVerdict: text("ai_verdict", { enum: ["pursue", "probe", "pass"] }),
    aiAnalyzedAt: integer("ai_analyzed_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("leads_status_idx").on(t.status)],
);

// ---- Lead assets (the unorganized dump: files, photos, anything about a lead) ----
// Leads are pre-organization, so these can't live in `assets` (org_id NOT NULL there).
// Bytes in R2 under leads/<leadId>/…, metadata here. Staff-only, always internal.
export const leadAssets = sqliteTable(
  "lead_assets",
  {
    id: pk(),
    leadId: text("lead_id").notNull().references(() => leads.id),
    fileName: text("file_name").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("lead_assets_lead_idx").on(t.leadId)],
);

// ---- Contacts (a person, distinct from portal users; may never log in) ----
// ONE record from first hello — never converted, never frozen. "Lead" is the
// to_qualify state; qualification flips state and creates a deal referencing the SAME
// row, so an email edit anywhere updates everywhere. Absorbs the old `leads` table
// (now dormant): source/AI-scout fields live here.
export const contacts = sqliteTable(
  "contacts",
  {
    id: pk(),
    // Current account. Nullable: a triage contact may be an unknown ("Reddit DM").
    organizationId: text("organization_id").references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    notes: text("notes"),
    state: text("state", { enum: CONTACT_STATES }).notNull().default("qualified"),
    source: text("source"), // website form, referral, airport bar, Reddit…
    companyNote: text("company_note"), // free-text company until an account exists
    estValueCents: integer("est_value_cents").notNull().default(0), // gut call at capture
    assignedToUserId: text("assigned_to_user_id").references(() => users.id), // null = unowned
    createdByUserId: text("created_by_user_id").references(() => users.id),
    // The AI scout's take (expert opinion + web recon), 1–10 score, verdict.
    aiAnalysisMd: text("ai_analysis_md"),
    aiScore: integer("ai_score"),
    aiVerdict: text("ai_verdict", { enum: ["pursue", "probe", "pass"] }),
    aiAnalyzedAt: integer("ai_analyzed_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_state_idx").on(t.state), index("contacts_org_idx").on(t.organizationId)],
);

// ---- Contact assets (files/photos about a contact — the triage dump) ----
// Successor to lead_assets (contacts absorbed leads). Bytes in R2, metadata here.
export const contactAssets = sqliteTable(
  "contact_assets",
  {
    id: pk(),
    contactId: text("contact_id").notNull().references(() => contacts.id),
    fileName: text("file_name").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("contact_assets_contact_idx").on(t.contactId)],
);

// ---- Contact ↔ company (many-to-many: "same Adam, now with company B") ----
export const contactCompanies = sqliteTable(
  "contact_companies",
  {
    id: pk(),
    contactId: text("contact_id").notNull().references(() => contacts.id),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    title: text("title"), // role AT this company (may differ per company)
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    current: integer("current", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("contact_companies_contact_idx").on(t.contactId),
    index("contact_companies_org_idx").on(t.organizationId),
  ],
);

// ---- Deals (one potential engagement moving through sales stages) ----
// stage is a DISPOSITION — the service layer allows any→any move. stageEnteredAt
// powers days-in-stage / stuck detection for the Monday-meeting funnel view.
export const deals = sqliteTable(
  "deals",
  {
    id: pk(),
    // NULLABLE since the opportunities restructure: every deal hangs on a CONTACT
    // from day one; the account is optional until Create project → (born at win).
    organizationId: text("organization_id").references(() => organizations.id),
    name: text("name").notNull(),
    stage: text("stage", { enum: DEAL_STAGES }).notNull().default("discovery"),
    stageEnteredAt: integer("stage_entered_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    ownerUserId: text("owner_user_id").references(() => users.id), // the salesperson
    primaryContactId: text("primary_contact_id").references(() => contacts.id),
    sourceLeadId: text("source_lead_id").references(() => leads.id), // legacy (leads dormant)
    // Provenance for the loop; 'spawned_from_project' deals get the fast-lane chip.
    origin: text("origin", { enum: DEAL_ORIGINS }).notNull().default("qualified_from_triage"),
    // Free substatus chip shown on negotiating cards ("redlines with counsel",
    // "verbal yes · terms open"). Cleared on stage moves by the service layer.
    subStatus: text("sub_status"),
    // Commercial shape. These are independent choices: what kind of work it is,
    // how it is delivered, what happens to IP, and how sensitive the data is.
    engagementType: text("engagement_type", { enum: ENGAGEMENT_TYPES }),
    deliveryModel: text("delivery_model", { enum: DELIVERY_MODELS }),
    ipDisposition: text("ip_disposition", { enum: IP_DISPOSITIONS }).notNull().default("undecided"),
    // The D1 column retains its legacy 'standard' fallback because changing a
    // SQLite default rebuilds this heavily referenced table. Supported creation
    // services always write DEFAULT_DATA_SENSITIVITY explicitly instead.
    dataSensitivity: text("data_sensitivity", { enum: DATA_SENSITIVITIES }).notNull().default("standard"),
    supportExpectation: text("support_expectation"),
    expectedCloseAt: integer("expected_close_at", { mode: "timestamp" }),
    // The one explicit mutual commitment. The deal owner remains accountable for
    // following it even when the ball is in the client's or a third party's court.
    nextAction: text("next_action"),
    nextActionDueAt: integer("next_action_due_at", { mode: "timestamp" }),
    nextActionCourt: text("next_action_court", { enum: NEXT_ACTION_COURTS }).notNull().default("wahala"),
    // MEDDPICC-lite evidence. Free text is deliberate for the first live deals;
    // normalize contacts/decision workflows only after real usage shows the shape.
    champion: text("champion"),
    economicBuyer: text("economic_buyer"),
    compellingEvent: text("compelling_event"),
    decisionProcess: text("decision_process"),
    budgetStatus: text("budget_status", { enum: BUDGET_STATUSES }).notNull().default("unknown"),
    budgetEvidence: text("budget_evidence"),
    // Committed-stage deposit (manual, no PSP): amount + sent/paid marks. Create
    // project is gated on depositPaidAt (admins may force).
    depositCents: integer("deposit_cents").notNull().default(0),
    depositSentAt: integer("deposit_sent_at", { mode: "timestamp" }),
    depositPaidAt: integer("deposit_paid_at", { mode: "timestamp" }),
    // Proposal-readiness (0–10, one decimal) — recomputed from Discovery Package
    // completeness after reviewed evidence or a manual edit is accepted; historical
    // values live as per-event snapshots in process_events, never mutated here.
    readinessScore: real("readiness_score"),
    // Auto post-mortem written when the deal is dropped on Lost (frame 40).
    postMortemMd: text("post_mortem_md"),
    // Agent layer (docs/AGENT-LAYER-DESIGN.md): fit = "value to the business"
    // 0–10, AI-scored by the deal pulse with a shown rationale, manually
    // overridable. priorityScore is DERIVED (fit × value × stage anchor)
    // but denormalized so list views and queue tie-breaks avoid recompute.
    // agentSpendCents = running total of ai_runs cost — the budget meter.
    fitScore: real("fit_score"),
    fitRationaleMd: text("fit_rationale_md"),
    fitScoredAt: integer("fit_scored_at", { mode: "timestamp" }),
    // Health and action urgency are deliberately separate from portfolio
    // attractiveness. A stale deal may be unhealthy AND urgently need follow-up.
    engagementHealthScore: real("engagement_health_score"),
    actionUrgencyScore: real("action_urgency_score"),
    priorityScore: real("priority_score"),
    agentSpendCents: real("agent_spend_cents").notNull().default(0),
    // Rough deal value for pipeline totals — a gut number, NOT a quote. Quoting
    // stays on stages/phases where the price authority rules live.
    valueCents: integer("value_cents").notNull().default(0),
    notes: text("notes"),
    // The Discovery Package (R2): markdown distilled from call transcripts/notes —
    // business profile, workflows, goals, pain points, decision makers, terminology.
    // Editable by staff; seeds the org's AI memory when the deal is won.
    discoveryMd: text("discovery_md"),
    // Short paragraph of what discovery actually learned (HANDOFF-DELTA-2026-07-07)
    // — grounds the proposal exec summary; distinct from the long-form discoveryMd.
    discoveryNote: text("discovery_note"),
    // R4 seam: set when the contract executes and the SOW becomes a real project
    // ("signed contract automatically creates a project"). Plain text — projects is
    // declared later in this file, and the link is one-way from the sales side.
    projectId: text("project_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("deals_org_idx").on(t.organizationId),
    index("deals_stage_idx").on(t.stage),
  ],
);

// ---- Discovery package (frames 38/39) — the structured record behind readiness ----
// One row per deal; `fields` holds the Discovery Package evidence plus nested
// Buying-path classifications. Each item is
// { status: "ok"|"partial"|"missing", evidence?: string, source?: string }.
// AI may propose updates from a call; staff explicitly accept them. DISCOVERY x/10
// derives only from the eight accepted Discovery Package fields.
export const discoveryPackages = sqliteTable(
  "discovery_packages",
  {
    id: pk(),
    dealId: text("deal_id").notNull().references(() => deals.id).unique(),
    fields: text("fields", { mode: "json" }).notNull(),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [index("discovery_packages_deal_idx").on(t.dealId)],
);

// ---- Recorded calls on a deal (frame 38) — transcript in, reviewed evidence out ----
export const dealCalls = sqliteTable(
  "deal_calls",
  {
    id: pk(),
    dealId: text("deal_id").notNull().references(() => deals.id),
    title: text("title").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    durationMin: integer("duration_min"),
    transcriptMd: text("transcript_md").notNull(),
    // How many of the eight Discovery Package fields this call filled or improved.
    fieldsExtracted: integer("fields_extracted").notNull().default(0),
    // One AI pass proposes the long-form memo, readiness evidence,
    // qualification facts, and commercial classifications. Nothing reaches the
    // Deal until a staff member reviews this payload and explicitly applies it.
    discoveryAnalysis: text("discovery_analysis", { mode: "json" }),
    // Manual calls are explicitly inserted as not_analyzed; automatic sources
    // insert pending after their AI pass. The legacy DB default remains applied.
    reviewStatus: text("review_status", { enum: DISCOVERY_REVIEW_STATUSES }).notNull().default("applied"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("deal_calls_deal_idx").on(t.dealId)],
);

// ---- Process events (frames 40/41) — append-only; guidance and measurement share it ----
// ownerUserId = the deal's owner AT THE TIME (scorecard grouping survives reassignment).
export const processEvents = sqliteTable(
  "process_events",
  {
    id: pk(),
    organizationId: text("organization_id").references(() => organizations.id), // null on account-less opportunities
    dealId: text("deal_id").notNull().references(() => deals.id),
    ownerUserId: text("owner_user_id").references(() => users.id),
    actorUserId: text("actor_user_id").references(() => users.id),
    kind: text("kind", { enum: PROCESS_EVENT_KINDS }).notNull(),
    fromStep: text("from_step"),
    toStep: text("to_step"),
    // Readiness snapshot at the moment of the event — "readiness at advance" queries.
    readinessScore: real("readiness_score"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("process_events_deal_idx").on(t.dealId),
    index("process_events_owner_idx").on(t.ownerUserId, t.kind),
  ],
);

// ---- Per-user integrations (frames 47/48) ----
// One row per (user, provider). Refresh tokens live plaintext in D1 — same trust
// level as the session KV; revoke via Google account settings + row delete.
// Disconnect is SOFT (disconnectedAt) so the frame-48 30s Undo can restore the
// token without re-auth; a row counts as connected only while disconnectedAt IS NULL.
export const INTEGRATION_PROVIDERS = ["google_calendar"] as const;
export const userIntegrations = sqliteTable(
  "user_integrations",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => users.id),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    email: text("email"), // the connected Google identity (may differ from login email)
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }), // frame 47 "last sync {rel}" is real
    disconnectedAt: integer("disconnected_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("user_integrations_user_provider_idx").on(t.userId, t.provider)],
);

// ---- Meetings (frames 42–46) — Google events are the spine ----
// "No calendar page": meetings render on the objects they belong to. Rows arrive
// from per-member calendar sync (source 'google') or portal scheduling (source
// 'portal'). Linkage (account/deal/project) is the PORTAL's truth; time + attendee
// responses are GOOGLE's truth. Unlinked rows are the frame-45 inbox. imminent/live
// are computed from the clock, never stored.
export const MEETING_STATUSES = ["upcoming", "ended", "awaiting_recording", "digest_ready"] as const;
export const VIDEO_PROVIDERS = ["zoom", "manual"] as const;
export const MEETING_SOURCES = ["portal", "google"] as const;
export const meetings = sqliteTable(
  "meetings",
  {
    id: pk(),
    googleEventId: text("google_event_id").unique(),
    googleCalendarId: text("google_calendar_id"),
    /** Kept for the Zoom transcript webhook's keying (nullable — Zoom optional). */
    zoomMeetingId: text("zoom_meeting_id").unique(),
    organizationId: text("organization_id").references(() => organizations.id),
    dealId: text("deal_id").references(() => deals.id),
    projectId: text("project_id"), // no FK: projects is declared later in this file
    title: text("title").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }),
    /** [{ email, name?, response? }] — responses mirrored from Google on sync. */
    attendees: text("attendees", { mode: "json" }),
    videoUrl: text("video_url"),
    videoProvider: text("video_provider", { enum: VIDEO_PROVIDERS }),
    startUrl: text("start_url"), // Zoom host link (portal-scheduled only)
    status: text("status", { enum: MEETING_STATUSES }).notNull().default("upcoming"),
    // Momentum signal (agent layer): bumped on every reschedule — "missed
    // meetings should absolutely drop the opportunity lower."
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    /** Auto-match suggestion for the inbox ("looks like Harbor Point — domain match"). */
    suggestedOrganizationId: text("suggested_organization_id"),
    suggestionReason: text("suggestion_reason"),
    /** Held here only while unlinked; graduates into deal_calls on link/ingest. */
    transcriptMd: text("transcript_md"),
    callId: text("call_id"), // deal_calls row once ingested (no FK: defined later)
    createdByUserId: text("created_by_user_id").references(() => users.id),
    /** Whose connected calendar synced it in (portal rows: the scheduler). */
    syncedByUserId: text("synced_by_user_id").references(() => users.id),
    source: text("source", { enum: MEETING_SOURCES }).notNull().default("google"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("meetings_deal_idx").on(t.dealId),
    index("meetings_org_idx").on(t.organizationId),
    index("meetings_status_idx").on(t.status),
    index("meetings_starts_idx").on(t.startsAt),
  ],
);

// ---- Meeting suppressions ("Not client work", frame 45 — teaches the matcher) ----
export const meetingSuppressions = sqliteTable(
  "meeting_suppressions",
  {
    id: pk(),
    /** Suppress one event, or a whole recurring series when Google provides one. */
    googleEventId: text("google_event_id"),
    recurringEventId: text("recurring_event_id"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("meeting_suppressions_event_idx").on(t.googleEventId)],
);

// ---- Contract items (R4: the commercials checklist — MSA, NDA, insurance…) ----
// The contract is a PHASE, not a document: these rows track the paperwork getting
// signed. v1 tracks status only (the documents themselves live outside the portal);
// the SOW is NOT a row here — it's the project the contract execution creates.
export const contractItems = sqliteTable(
  "contract_items",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    dealId: text("deal_id").notNull().references(() => deals.id),
    kind: text("kind", { enum: CONTRACT_ITEM_KINDS }).notNull(),
    label: text("label").notNull(),
    status: text("status", { enum: ["pending", "signed"] }).notNull().default("pending"),
    signedAt: integer("signed_at", { mode: "timestamp" }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contract_items_deal_idx").on(t.dealId)],
);

// ---- Agreements (the agreement package: account-level legal + per-deal docs) ----
// Successor to contract_items. MSA/NDA are account-level (deal_id is provenance only);
// commercial agreement / PS terms / IP schedule etc. are per-deal. Once the account's
// MSA is signed, later deals' packages are SOW-only (the fast lane).
export const agreements = sqliteTable(
  "agreements",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    dealId: text("deal_id").references(() => deals.id), // null = account-level doc
    kind: text("kind", { enum: AGREEMENT_KINDS }).notNull(),
    label: text("label").notNull(),
    status: text("status", { enum: AGREEMENT_STATUSES }).notNull().default("needed"),
    signedAt: integer("signed_at", { mode: "timestamp" }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("agreements_org_idx").on(t.organizationId), index("agreements_deal_idx").on(t.dealId)],
);

// ---- Proposals (R3: the commercial offering — always Option A / Option B) ----
// HIGH LEVEL by design: what we build, why it solves the problem, how long. The AI
// drafts scope and complexity; ONLY an admin sets prices. Versioned — sending a new
// version supersedes older open ones ("we're gonna rewrite it, and it's proposal two").
// Approval is the good-faith agreement to proceed (NO deposit) and moves the deal to
// the contract stage. Negotiation is a function within proposal, not a new artifact.
export const proposals = sqliteTable(
  "proposals",
  {
    id: pk(),
    organizationId: text("organization_id").references(() => organizations.id), // null until the deal's account is born
    dealId: text("deal_id").notNull().references(() => deals.id),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("draft"),
    title: text("title").notNull(),
    executiveSummaryMd: text("executive_summary_md"),
    assumptionsMd: text("assumptions_md"),
    // Internal coverage review: every explicit MVP capability is included,
    // deferred, or left as a question for each option. Never shown to clients.
    coverage: text("coverage", { mode: "json" }).$type<import("../domain/proposal-doc").ProposalCoverageReview | null>(),
    // AI complexity read (1–5). Above 3 = "needs engineering hardcore review" — a
    // SOFT flag (banner + confirm), never a hard gate inside the sales funnel.
    complexityScore: integer("complexity_score"),
    complexityRationale: text("complexity_rationale"),
    // Unguessable public token — the prospect reads/approves at /p/[token], no login.
    shareToken: text("share_token").unique(),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
    respondedByName: text("responded_by_name"), // typed name from the public approve
    responseNote: text("response_note"),
    selectedOptionId: text("selected_option_id"),
    // Who on the client side can sign / approve amendments (HANDOFF-DELTA-2026-07-07).
    approvers: text("approvers", { mode: "json" }).$type<import("../domain/proposal-doc").Approver[] | null>(),
    // The Contract/SOW document — a one-time SNAPSHOT of the chosen option (never a
    // live binding). Draft→sent→executed lifecycle + amendment log live inside.
    contract: text("contract", { mode: "json" }).$type<import("../domain/proposal-doc").ProposalContract | null>(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("proposals_deal_idx").on(t.dealId)],
);

export const proposalOptions = sqliteTable(
  "proposal_options",
  {
    id: pk(),
    proposalId: text("proposal_id").notNull().references(() => proposals.id),
    label: text("label").notNull(), // "A"–"H" (up to 8 options)
    name: text("name").notNull(), // e.g. "Phased buildout"
    summaryMd: text("summary_md").notNull(),
    // One-shot delivery detail (and option-level scope for phased paths). Phase-
    // specific detail lives inside the existing phases JSON objects.
    scopeDetails: text("scope_details", { mode: "json" }).$type<import("../domain/proposal-doc").ProposalScopeDetails | null>(),
    timelineNote: text("timeline_note"),
    // Admin-set. 0 = not priced yet; EVERY option must be priced before send.
    priceCents: integer("price_cents").notNull().default(0),
    priceNote: text("price_note"), // e.g. "+ $500/mo platform subscription"
    sortOrder: integer("sort_order").notNull().default(0),
    // null = lump-sum option; array = the phased sign-off structure (statuses
    // mutate post-approval via the in-app Activate & amend mechanic).
    phases: text("phases", { mode: "json" }).$type<import("../domain/proposal-doc").ProposalPhase[] | null>(),
    // Admin-chosen, never automatic; zero recommended options is valid.
    recommended: integer("recommended", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("proposal_options_proposal_idx").on(t.proposalId)],
);

// ---- Projects (any kind of work) ----
export const projects = sqliteTable(
  "projects",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    workType: text("work_type"), // free category; not assumed to be software
    // Paid discovery runs as a small project whose deliverable spawns the big deal.
    kind: text("kind", { enum: PROJECT_KINDS }).notNull().default("standard"),
    // AI draft's memory artifact for this project (## Read / ## Inferred / ## Assumptions
    // / ## Open questions). Lets later lightweight AI calls skip re-reading the source docs.
    aiContextMd: text("ai_context_md"),
    status: text("status", {
      enum: ["discovery", "active", "paused", "completed", "archived"],
    })
      .notNull()
      .default("discovery"),
    leadEngineerUserId: text("lead_engineer_user_id").references(() => users.id),
    linearProjectId: text("linear_project_id"), // optional, software projects only (Phase 2)
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_org_idx").on(t.organizationId)],
);

// ---- Project roster (1..N engineers; solo or team, same model) ----
export const projectMembers = sqliteTable(
  "project_members",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    projectId: text("project_id").notNull().references(() => projects.id),
    userId: text("user_id").notNull().references(() => users.id),
    projectRole: text("project_role", { enum: ["lead", "engineer"] })
      .notNull()
      .default("engineer"),
    createdAt: createdAt(),
  },
  (t) => [index("project_members_project_idx").on(t.projectId)],
);

// ---- Stages (the billable spine; full payment before work) ----
// INVARIANT (enforce in service layer): status must not become 'in_progress'
// unless paidAt is set. No build-first-bill-later.
export const stages = sqliteTable(
  "stages",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    projectId: text("project_id").notNull().references(() => projects.id),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull().default(0),
    scopeDescription: text("scope_description"),
    status: text("status", { enum: STAGE_STATUSES }).notNull().default("draft"),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    // When the client pays: 'upfront' (pay after approve, before work — the classic
    // hard pay-gate) or 'on_delivery' (work starts on approve; payment gate moves to
    // acceptance). Set at Quote time; locked once the quote is sent.
    billingMode: text("billing_mode", { enum: BILLING_MODES }).notNull().default("upfront"),
    // threshold price authority: over the $ threshold, a Wahala Admin must co-sign
    requiresAdminApproval: integer("requires_admin_approval", { mode: "boolean" })
      .notNull()
      .default(false),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    quoteApprovedAt: integer("quote_approved_at", { mode: "timestamp" }),
    stripeRef: text("stripe_ref"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    // formal, logged client acceptance
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("stages_project_idx").on(t.projectId)],
);

// ---- Stage line items (itemized scope = quote + acceptance checklist) ----
export const stageLineItems = sqliteTable(
  "stage_line_items",
  {
    id: pk(),
    stageId: text("stage_id").notNull().references(() => stages.id),
    // Epic/category this deliverable groups under (e.g. "Authentication & Identity").
    groupLabel: text("group_label"),
    description: text("description").notNull(),
    estimateNote: text("estimate_note"),
    // Optional/illustrative per-item price. The stage carries the authoritative fixed
    // price (totalAmountCents); item amounts no longer have to sum to it.
    amountCents: integer("amount_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    accepted: integer("accepted", { mode: "boolean" }).notNull().default(false), // per-item client acceptance (future)
    // Wahala-side delivery progress: the assigned staff mark a deliverable done while work is underway.
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completedByUserId: text("completed_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("stage_line_items_stage_idx").on(t.stageId)],
);

// ---- Deliverable notes (client-visible progress log on a deliverable as it's worked) ----
export const deliverableNotes = sqliteTable(
  "deliverable_notes",
  {
    id: pk(),
    stageLineItemId: text("stage_line_item_id").notNull().references(() => stageLineItems.id),
    authorUserId: text("author_user_id").references(() => users.id),
    body: text("body").notNull(),
    // Staff choose per note: client_visible (the customer sees it) or internal (staff only).
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("client_visible"),
    createdAt: createdAt(),
  },
  (t) => [index("deliverable_notes_item_idx").on(t.stageLineItemId)],
);

// ---- Tasks (internal work; client-visible by default) ----
export const tasks = sqliteTable(
  "tasks",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    projectId: text("project_id").notNull().references(() => projects.id),
    stageId: text("stage_id").references(() => stages.id),
    stageLineItemId: text("stage_line_item_id").references(() => stageLineItems.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["todo", "in_progress", "blocked", "done", "cancelled"],
    })
      .notNull()
      .default("todo"),
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("client_visible"),
    aiAssisted: integer("ai_assisted", { mode: "boolean" }).notNull().default(false),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_stage_idx").on(t.stageId),
  ],
);

// ---- Task assignments (assignee may be a Wahala engineer, a client, or later AI) ----
// A task assigned to a client surfaces as an "on you" action item for that client.
export const taskAssignments = sqliteTable(
  "task_assignments",
  {
    id: pk(),
    taskId: text("task_id").notNull().references(() => tasks.id),
    assigneeUserId: text("assignee_user_id").references(() => users.id), // null when assigneeType = 'ai'
    assigneeType: text("assignee_type", { enum: ["wahala", "client", "ai"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_assignments_task_idx").on(t.taskId)],
);

// ---- Task subtasks (engineering checklist under a task; inherit task visibility) ----
export const taskSubtasks = sqliteTable(
  "task_subtasks",
  {
    id: pk(),
    taskId: text("task_id").notNull().references(() => tasks.id),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("task_subtasks_task_idx").on(t.taskId)],
);

// ---- Task notes (append-only worklog: "what was done"; inherit task visibility) ----
export const taskNotes = sqliteTable(
  "task_notes",
  {
    id: pk(),
    taskId: text("task_id").notNull().references(() => tasks.id),
    authorUserId: text("author_user_id").references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_notes_task_idx").on(t.taskId)],
);

// ---- Change orders (out-of-scope re-quotes; reuse the approve→pay gate) ----
export const changeOrders = sqliteTable("change_orders", {
  id: pk(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  stageId: text("stage_id").references(() => stages.id),
  // Optional task this change attaches to — it renders as a flagged "Change" subitem there.
  taskId: text("task_id").references(() => tasks.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: STAGE_STATUSES }).notNull().default("draft"),
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  requiresAdminApproval: integer("requires_admin_approval", { mode: "boolean" })
    .notNull()
    .default(false),
  stripeRef: text("stripe_ref"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---- Assets (files + meeting recordings; visibility-flagged) ----
// Recordings + AI analyses are visibility='internal' — clients never see them.
export const assets = sqliteTable(
  "assets",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    projectId: text("project_id").references(() => projects.id),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
    fileName: text("file_name").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    type: text("type", {
      enum: ["document", "image", "recording", "transcript", "summary", "other"],
    })
      .notNull()
      .default("other"),
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("internal"),
    createdAt: createdAt(),
  },
  (t) => [index("assets_org_idx").on(t.organizationId)],
);

// ---- Messages (communication; visibility + "waiting on whom") ----
export const messages = sqliteTable(
  "messages",
  {
    id: pk(),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    projectId: text("project_id").references(() => projects.id),
    stageId: text("stage_id").references(() => stages.id),
    senderUserId: text("sender_user_id").references(() => users.id),
    body: text("body").notNull(),
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("client_visible"),
    waitingOn: text("waiting_on", { enum: ["none", "client", "wahala"] })
      .notNull()
      .default("none"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_project_idx").on(t.projectId)],
);

// ---- Audit log (accountability trail: who did what, when) ----
export const auditLog = sqliteTable("audit_log", {
  id: pk(),
  organizationId: text("organization_id").references(() => organizations.id), // null on account-less opportunities

  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. 'quote.approved', 'stage.paid', 'stage.accepted'
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: createdAt(),
});

// ---- Notifications (in-app nudges from the scheduled SLA job; staff-facing) ----
export const NOTIFICATION_KINDS = ["deal_stuck", "proposal_followup", "lead_overdue", "suggestion", "budget_exhausted"] as const;
export const notifications = sqliteTable(
  "notifications",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => users.id), // recipient (staff)
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    entityType: text("entity_type", { enum: ["deal", "proposal", "lead", "contact"] }).notNull(),
    entityId: text("entity_id").notNull(),
    href: text("href").notNull(), // deep link into the app
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: integer("read_at", { mode: "timestamp" }),
    emailedAt: integer("emailed_at", { mode: "timestamp" }), // escalation email sent (once per spell)
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

// ---- AI runs (agent layer, docs/AGENT-LAYER-DESIGN.md) ----
// Every AI call, persisted: the money meter behind per-deal budgets. costCents
// is the same local estimate DraftUsage carries — approximate, but consistent.
export const AI_RUN_TRIGGERS = ["user", "cron", "webhook"] as const;
export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: pk(),
    agentKey: text("agent_key").notNull(), // registry key (lead_scout, deal_pulse, …)
    trigger: text("trigger", { enum: AI_RUN_TRIGGERS }).notNull().default("user"),
    dealId: text("deal_id"), // no FK: runs outlive dev-deleted deals
    contactId: text("contact_id"),
    organizationId: text("organization_id"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: real("cost_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("ai_runs_deal_idx").on(t.dealId), index("ai_runs_agent_idx").on(t.agentKey, t.createdAt)],
);

// ---- Suggestions (the suggestion box — how agents talk to humans) ----
// Agents write concrete next actions here; humans do or dismiss. Agents never
// act on the outside world themselves.
export const SUGGESTION_STATUSES = ["open", "done", "dismissed"] as const;
export const suggestions = sqliteTable(
  "suggestions",
  {
    id: pk(),
    dealId: text("deal_id").notNull().references(() => deals.id),
    organizationId: text("organization_id"),
    agentKey: text("agent_key").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md"),
    status: text("status", { enum: SUGGESTION_STATUSES }).notNull().default("open"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("suggestions_deal_idx").on(t.dealId, t.status)],
);

// ---- relations (for Drizzle's query API) ----
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  accountOwner: one(users, {
    fields: [organizations.accountOwnerUserId],
    references: [users.id],
  }),
  users: many(users),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  leadEngineer: one(users, {
    fields: [projects.leadEngineerUserId],
    references: [users.id],
  }),
  members: many(projectMembers),
  stages: many(stages),
  tasks: many(tasks),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  project: one(projects, { fields: [stages.projectId], references: [projects.id] }),
  lineItems: many(stageLineItems),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  stage: one(stages, { fields: [tasks.stageId], references: [stages.id] }),
  assignments: many(taskAssignments),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignments.taskId], references: [tasks.id] }),
  assignee: one(users, {
    fields: [taskAssignments.assigneeUserId],
    references: [users.id],
  }),
}));
