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

_Last updated: after the Clients cascade-delete capability._

---

## Original 13 frames → build status

| # | Frame | Status | Route | Notes |
|---|-------|--------|-------|-------|
| 01 | Foundations | ✅ | — | Tokens + fonts (Hanken Grotesk / IBM Plex Mono) + components: StatusBadge, Stepper, Money, WaitingOn, VisibilityMarker, Avatar/PeopleCard, HistoryTimeline, Brand, ActionBar. (`VisibilityMarker` exists but isn't on a screen yet — waits for Tasks/Files.) |
| 02 | Login | ✅ 🔼 | `/login` | Built. **Changed:** now has **"Continue with Google"** above the magic-link form (SSO was added). |
| 03 | Client dashboard | ✅ | `/dashboard` | Ink sidebar, greeting, "On you" cards, projects grid. Staff variant also built ("Needs Wahala"). |
| 04 | Project detail | ✅ | `/dashboard/projects/:id` | Breadcrumb, people row (owner/lead/roster), numbered stage rows. |
| 05 | Stage detail (key) | ✅ | `/dashboard/stages/:id` | Stepper, Paid banner, line-item checklist, right-rail action panel + ConfirmDialog. |
| 06 | Quote / scope builder | 🟡 | (inline on project) | Only a basic create-stage form (name, amount, line items) exists — **not** the designed reorderable LineItemEditor with the over-threshold co-sign banner. |
| 07 | Acceptance (mobile) | 🟡 | (on stage detail) | The accept action + ConfirmDialog exist on the stage screen; the **dedicated mobile acceptance screen** (phone frame, checklist) is not built. |
| 08 | Payment hand-off | ⬜ | — | Pending Stripe. The pay-gate logic exists; no checkout/return UI. |
| 09 | Tasks (delivery) | ✅ | (on stage detail) | Built as a section on the stage screen: table (Task / Assignee / Status / Visibility), staff add-task + inline status controls, clients read-only; **internal tasks hidden from clients**. |
| 10 | Files / assets | ⬜ | — | R2 is bound; no upload/list UI. |
| 11 | Messages / comms | ⬜ | — | Not built. |
| 12 | Client account hub | ⬜ | — | Not built (the Clients list below is the closest staff-side piece). |
| 13 | Build note | — | — | Reference only; the server/island split is followed. |

---

## New screens / changes NOT in the original handoff (please add to the design)

| Item | Status | Route | What it is |
|------|--------|-------|-----------|
| 🔼 **Clients** (handoff frame 14 / 14b) | ✅ built | `/dashboard/clients` | Staff-only. Admin onboards a prospect (company, contact, **intake notes**), **Invite** (magic-link email), tracks **Invited → Accepted**, and can **delete a client** — admin-only **cascade** delete (removes the org + all its projects/stages/tasks/history) behind a destructive confirm modal. For resetting test data. |
| 🔼 **"Continue with Google"** | ✅ built | `/login` | Google SSO button + "or" divider; surfaces `?error=` messages. |
| 🔼 Staff auto-provisioning | ✅ built | (no UI) | A `@wahalagroup.com` Google login auto-becomes a Wahala admin. No screen, but affects who sees the staff views. |

---

## Visual notes / deviations to be aware of
- **Status colors, type, spacing** were implemented to the handoff tokens (see `src/lib/theme.ts` + `src/app/globals.css`).
- **ConfirmDialog** is currently inline inside the ActionBar island (`src/components/StageActions.tsx`) rather than a standalone component — same behavior, used for accept / reject / request-revision / mark-paid.
- **Sidebar nav** gained a staff-only **Clients** entry; Files/Messages remain present-but-"soon".
- The client **account hub (frame 12)** is still aspirational; the new **Clients** list partially covers the "see your clients" need from the staff side.

---

## How to use this doc
1. **To update the design:** paste this file into your Claude Design session and say *"bring the designs in line with this status, and add a frame for the new Clients screen."* Export the refreshed `.dc.html` + README into `design_handoff_wahala_portal/`.
2. **To update the build:** hand the refreshed handoff back to Claude Code and ask it to implement the diff.
3. The build keeps this file current each time a screen ships, so it's always the source of truth for "what's designed vs what's built."
