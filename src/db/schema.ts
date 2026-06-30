/**
 * Wahala Portal — database schema (Cloudflare D1 / SQLite via Drizzle).
 *
 * Encodes the Phase 1 data model from docs/PLAN.md §7. Key decisions baked in:
 *  - Pay-as-you-go STAGES are the billable spine; full payment before work.
 *  - INVARIANT (enforced in the service layer, see note on `stages`): a stage
 *    cannot move to `in_progress` until it is paid.
 *  - Project → Stages (client pays per stage) → Tasks (internal work).
 *  - Account Owner (relationship) + Lead Engineer (delivery); roster scales 1..N.
 *  - Tasks are client-visible by default; assignees may be a Wahala engineer OR a
 *    client (an "on you" action item), and later an AI worker.
 *  - Assets carry a visibility flag; recordings + AI digests are internal-only.
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

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
    createdAt: createdAt(),
  },
  (t) => [index("users_org_idx").on(t.organizationId)],
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
// Recordings + Phase-2 AI digests are visibility='internal' — clients never see them.
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
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. 'quote.approved', 'stage.paid', 'stage.accepted'
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: createdAt(),
});

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
