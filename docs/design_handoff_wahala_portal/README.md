# Handoff: Wahala Portal — CRM + Client Portal

## Overview
Wahala Portal is the internal **CRM + client portal** for *Wahala Group*, a lean
services firm. One app, two audiences: **Wahala staff** running client work, and
**clients** watching that work and approving/paying for it. The product sells
accountability and clear communication — every client has a dedicated account
owner, every dollar maps to an itemized scope **paid before work begins**, every
delivery is **formally accepted**, and every action is logged.

The spine of the product is the **pay-as-you-go Phase lifecycle**. This package
covers the brand/design-system and the priority screens for the first build pass.

> **Naming (06 Jul 2026):** the project delivery unit is **Phase**
> (draft→quoted→approved→paid→in_progress→delivered→accepted) — the old "Stage"
> name. **Stage** is now reserved for the deal pipeline (Triage → Discovery →
> Proposal out → Negotiating → Committed, see `CRM-RESTRUCTURE.md`). Phases
> belong to projects, Stages belong to deals. Older docs in this folder may still
> say "stage" for a project phase — that's the pre-06-Jul name; the canvas
> (`Wahala Portal.dc.html`) hasn't been relabeled yet either.

## About the Design Files
The file in this bundle (`Wahala Portal.dc.html`) is a **design reference created
in HTML** — a prototype showing intended look and behavior, **not production code
to copy directly**. It is a single pannable "canvas" of labeled frames — the
brand/design-system panel, the delivery screens (01–20), the **sales pipeline
(21–27)**, the **CRM restructure (30–37)**, the **training & scorecard band (38–41)**, the
**calendar & meetings band (42–48)**, and a component note (C1). The task is to **recreate these
designs in the target codebase** (Next.js App Router / React Server Components on
Cloudflare Workers — see §9 below) using its established patterns, not to ship the
HTML as-is.

Open the file in a browser and zoom/pan to inspect each frame. Frames are labeled
`01 — Foundations` through `27 — Admin settings`, plus a component note (`C1`).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and component
treatments are intended to be implemented pixel-faithfully using the codebase's
own libraries. Exact tokens are in [`design-system.md`](design-system.md).

---

## How to use this handoff (for Claude Code)
This spec is **split into focused files** so you load only what a task needs.

1. **Always skim** [`design-system.md`](design-system.md) (tokens + core components) and
   [`patterns.md`](patterns.md) (architecture, state machine, constraints) — they apply everywhere.
2. **Then open the one screen file** for what you're building (see the map below).
3. The **visual reference** for every screen is the pannable canvas `Wahala Portal.dc.html`
   (open in a browser, zoom per frame). The Markdown is the source of truth for behavior; the
   canvas is the source of truth for look.

When the design changes, these files are re-generated and committed — read the git diff of the
relevant `.md` to see exactly what moved.

## Map
**Always-on**
- [`design-system.md`](design-system.md) — brand tokens, color, type, spacing, and the core components every screen composes.
- [`patterns.md`](patterns.md) — Server/Island split, phase state machine, state management, vocabulary, non-negotiable constraints, a11y, assets.
- [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md) — **(read before any sales/CRM work):** Contact/Account object model, 5-stage pipeline (frames 30–34), triage bypass, agreement checklist, deal→project loop. Supersedes the 7-column board in `BOARD-REDESIGN.md` and the lead/client vocabulary everywhere.
- [`TRAINING-AND-SCORECARD.md`](TRAINING-AND-SCORECARD.md) — training mode, readiness scoring, nudge-on-advance, deal post-mortem, admin scorecard (frames 38–41). One process model → guide / nudge / score.
- [`CALENDAR-AND-MEETINGS.md`](CALENDAR-AND-MEETINGS.md) — Google Calendar / Zoom integration UI (frames 42–48). MeetingCard states, schedule modal, today strip + meeting inbox, client call card, integrations settings, guarded disconnect. Zoom is not connected yet — the degraded states are the launch reality.
- [`HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md`](HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md) — **NEWEST, read before any Proposals work:** full phased-sign-off proposal rebuild + the new linked Contract/SOW document (Draft→Sent→Executed lock, amendment log, staleness/resync). **Supersedes `sales/proposals.md` entirely.** Reference is a real interactive prototype (`Wahala Portal - Interactive.dc.html` in this folder), not the static canvas — open it in a browser and click through it.

**Screens**
- [`design-system.md`](design-system.md) — Design system — tokens & core components
- [`screens/auth-and-onboarding.md`](screens/auth-and-onboarding.md) — Auth & onboarding
- [`screens/client-portal.md`](screens/client-portal.md) — Client-facing screens
- [`screens/delivery.md`](screens/delivery.md) — Delivery — phases, quote, tasks
- [`screens/staff-home-projects.md`](screens/staff-home-projects.md) — Staff home & projects
- [`screens/ai-project-draft.md`](screens/ai-project-draft.md) — Draft a project with AI (frames 18–20)
- [`sales/00-overview.md`](sales/00-overview.md) — Sales pipeline — overview & cross-cutting decisions
- [`sales/sales-home.md`](sales/sales-home.md) — Sales home / pipeline (frame 21)
- [`sales/leads.md`](sales/leads.md) — Leads — list & workspace (frames 22–23)
- [`sales/deal-room.md`](sales/deal-room.md) — Deal room (frame 24) — most important
- [`sales/proposals.md`](sales/proposals.md) — ~~Proposals — editor & public page (frames 25–26)~~ **STALE — superseded by [`HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md`](HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md).** Kept only for historical reference.
- [`sales/settings.md`](sales/settings.md) — Admin settings · AI agents (frame 27)
- [`patterns.md`](patterns.md) — Cross-cutting — architecture, behavior, constraints

---

## Frame → file quick reference
| Frame(s) | File |
|---|---|
| 01 Foundations · 02 Login · 13 Build note · 14 Clients onboarding · 15 Welcome | `screens/auth-and-onboarding.md` |
| 03 Dashboard · 04 Project · 07 Acceptance · 08 Payment · 10 Files · 11 Messages · 12 Account hub | `screens/client-portal.md` |
| 05 Stage detail · 06 Quote builder · 09 Tasks | `screens/delivery.md` |
| 16 Projects (staff) · 17 Staff home | `screens/staff-home-projects.md` |
| 18–20 Draft a project with AI | `screens/ai-project-draft.md` |
| 21 Sales home | `sales/sales-home.md` |
| 22 Leads · 23 Lead workspace | `sales/leads.md` |
| 24 Deal room | `sales/deal-room.md` |
| 25 Proposal editor · 26 Public proposal | ~~`sales/proposals.md`~~ → `HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md` (supersedes) |
| 27 Settings (AI agents) | `sales/settings.md` |
| Sales cross-cutting (IA, chips, markdown pattern) | `sales/00-overview.md` |
| **30–34 CRM restructure (canonical)** | `CRM-RESTRUCTURE.md` |
| 35 Invite · 36 Quote approval · 37 Closeout→next deal | `HANDOFF-DELTA-2026-07-04.md` |
| **38–41 Training mode, nudge, post-mortem, scorecard** | `TRAINING-AND-SCORECARD.md` |
| **42–48 Calendar, meetings & integrations (NEW)** | `CALENDAR-AND-MEETINGS.md` |

## Files in this folder
- `Wahala Portal.dc.html` — the full design canvas (all frames). Open in a browser.
- `Wahala Portal - Interactive.dc.html` — **real interactive prototype** for the Proposals + Contract/SOW feature (see the 07 Jul delta above). Click through it, don't just read about it.
- `support.js` — runtime both canvases need to render.
- `*.md` — the written spec, split as mapped above.
