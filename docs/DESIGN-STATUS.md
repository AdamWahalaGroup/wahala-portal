# Design ⇄ Build Status

> **The bridge between the Claude Design project and the codebase.** There's no
> automatic sync — this doc is the handoff loop:
> - **Code → Design:** paste this into your Claude Design session so the mockups
>   reflect what's actually built (and add new screens like Clients).
> - **Design → Code:** when the design changes, hand the refreshed handoff
>   (`design_handoff_wahala_portal/`) to the build (Claude Code) and it implements the diff.
>
> Kept current as UI ships. Companion to [DESIGN-BRIEF.md](./DESIGN-BRIEF.md) and the
> original handoff in [design_handoff_wahala_portal/](./design_handoff_wahala_portal/).

**Legend:** ✅ built · 🟡 partial · ⬜ not built · 🔼 new/changed vs the original handoff

_Last updated: after the client welcome (frame 15) + assign-agent-at-invite._

---

## Original 13 frames → build status

| # | Frame | Status | Route | Notes |
|---|-------|--------|-------|-------|
| 01 | Foundations | ✅ | — | Tokens + fonts (Hanken Grotesk / IBM Plex Mono) + components: StatusBadge, Stepper, Money, WaitingOn, VisibilityMarker, Avatar/PeopleCard, HistoryTimeline, Brand, ActionBar. (`VisibilityMarker` exists but isn't on a screen yet — waits for Tasks/Files.) |
| 02 | Login | ✅ 🔼 | `/login` | Built. **Changed:** now has **"Continue with Google"** above the magic-link form (SSO was added). |
| 03 | Client dashboard | ✅ | `/dashboard` | Ink sidebar, greeting, "On you" cards, projects grid. Staff variant also built ("Needs Wahala"). |
| 04 | Project detail | ✅ | `/dashboard/projects/:id` | Breadcrumb, people row (owner/lead/roster), numbered stage rows. |
| 05 | Stage detail (key) | ✅ | `/dashboard/stages/:id` | Stepper, Paid banner, line-item checklist, right-rail action panel + ConfirmDialog. |
| 06 | Quote / scope builder | ✅ | `/dashboard/stages/:id/quote` | Built. Dedicated staff screen: stage name + scope, **reorderable (drag-handle) line-item rows** with per-item amount + remove, dashed "+ Add line item", and a 320px summary rail — live **Quote total** (= sum of items) + **over-threshold co-sign banner** (`#FFFAF2`/`#FADCB4` when > the approval threshold, default $5,000) with a disabled "Send quote — awaiting co-sign" + "Request admin co-sign" for non-admins. Save draft / Send quote (draft→quoted). Entry points: **+ New stage** on the project (creates an empty draft → builder) and **Edit quote** on a draft stage. Replaced the old inline create-stage form. *(Needed a migration: `stage_line_items.amount_cents`.)* |
| 07 | Acceptance (mobile) | ✅ | `/dashboard/stages/:id/accept` | Built. Client-only, mobile-first (390px): "Delivered — your acceptance needed" badge, green ✓ line-item checklist with amounts, paid total, big green **Accept delivery** + outlined red **Request revision**, micro-note "Acceptance is final & recorded". Weighty confirm dialog for each (revision has a **note** textarea, logged to the stage audit). Reached from the dashboard "On you" CTA and a **Review & accept** button on a delivered stage. Buttons follow the client's allowed actions; non-delivered/staff/unauth redirect. |
| 08 | Payment hand-off | ⬜ | — | Pending Stripe. The pay-gate logic exists; no checkout/return UI. |
| 09 | Tasks (delivery) | ✅ | (on stage detail) | Built as a section on the stage screen: table (Task / Assignee / Status / Visibility), staff add-task + inline status controls, clients read-only; **internal tasks hidden from clients**. |
| 10 | Files / assets | ✅ | (on project detail) | Built as a section on the project screen: staff upload to **R2** (visibility choice), type tile + size·uploader·date meta + VisibilityMarker, download, staff delete. **Internal files hidden from clients — enforced on the list AND on direct download** (no URL bypass). |
| 11 | Messages / comms | ✅ | `/dashboard/messages` | Built. A **thread = a project**: 300px thread list (waiting-on dot, last-message snippet, org for staff) + thread view — header **WaitingOn pill** (phrased for the viewer), bubbles (Wahala left `#F4F5F7` / client right `#EEF0FE`, each with avatar + name + mono "{org} · {date time}"), and a composer (input + "Needs a reply from {them}" flag + Ink Send, ⌘/Ctrl-Enter). Auto-refreshes. Tenant- + visibility-scoped (clients never see internal; cross-tenant post → 404). |
| 12 | Client account hub | ✅ | `/dashboard/clients/[orgId]` | Built. Staff-only org home: header (logo tile, "Client since · N projects · N stages", account-owner card), tab row (Overview / Work history / People; Files + Messages shown "soon"), a **work-history timeline** (status-colored nodes, project · stage, mono "Label · date · $amount") + side cards (**Lifetime totals**: paid / accepted / open pipeline, **People**). Reached by clicking a row in the Clients list. |
| 13 | Build note | — | — | Reference only; the server/island split is followed. |

---

## New screens / changes NOT in the original handoff (please add to the design)

| Item | Status | Route | What it is |
|------|--------|-------|-----------|
| 🔼 **Clients** (handoff frame 14 / 14b) | ✅ built | `/dashboard/clients` | Staff-only. Admin onboards a prospect (company, contact, **intake notes**), assigns an **Account Owner / Wahala agent** (defaults to the inviter), **Invite** (magic-link email), tracks **Invited → Accepted**, and can **delete a client** — admin-only **cascade** delete behind a destructive confirm modal. *(PATCH reassign-agent not built yet.)* |
| 🔼 **Client welcome** (handoff frame 15) | ✅ built | `/dashboard` (client, no projects) | What a customer lands on right after accepting their invite: dark hero ("We build it, run it, and remove the wahala"), a **What we do** 2×2 offerings grid, and a **Your Wahala agent** card (the assigned account owner) with a Message (mailto) action. Replaced the bare greeting for new clients. |
| 🔼 **"Continue with Google"** | ✅ built | `/login` | Google SSO button + "or" divider; surfaces `?error=` messages. |
| 🔼 Staff auto-provisioning | ✅ built | (no UI) | A `@wahalagroup.com` Google login auto-becomes a Wahala admin. No screen, but affects who sees the staff views. |

---

## Visual notes / deviations to be aware of
- **Status colors, type, spacing** were implemented to the handoff tokens (see `src/lib/theme.ts` + `src/app/globals.css`).
- **ConfirmDialog** is currently inline inside the ActionBar island (`src/components/StageActions.tsx`) rather than a standalone component — same behavior, used for accept / reject / request-revision / mark-paid.
- **Sidebar nav** gained a staff-only **Clients** entry; **Messages** is now live; **Files** remains present-but-"soon" (files live on each project, not yet a top-level page).
- **Live updates:** the Clients list, the stage detail screen, and the dashboard now **auto-refresh** (poll every ~8s, only while something is pending and the tab is visible) so cross-session changes — e.g. a client accepting an invite, or a stage transition by the other party — appear without a manual refresh. (Polling, not realtime push; true instant updates would need a Durable Object.)

---

## How to use this doc
1. **To update the design:** paste this file into your Claude Design session and say *"bring the designs in line with this status, and add a frame for the new Clients screen."* Export the refreshed `.dc.html` + README into `design_handoff_wahala_portal/`.
2. **To update the build:** hand the refreshed handoff back to Claude Code and ask it to implement the diff.
3. The build keeps this file current each time a screen ships, so it's always the source of truth for "what's designed vs what's built."
