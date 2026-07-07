# Design system — tokens & core components

> Part of the **Wahala Portal** design handoff — see [handoff index](README.md). Visual reference: the labeled frames in `Wahala Portal.dc.html`.

## Stack context (§9 — so the implementation maps to live data)
- **Framework:** Next.js (App Router, **React Server Components**) on **Cloudflare
  Workers** (via OpenNext). Data in **Cloudflare D1**; **magic-link** auth; **KV**
  sessions.
- Keep the client bundle small. **Pages are server components**; only small
  interactive pieces are **client islands** (see Build Note frame 13 + the
  Server/Island table below).
- **Routes today:** `/login`, `/dashboard`, `/dashboard/projects/:id`,
  `/dashboard/phases/:id`.
- **JSON API:** `GET/POST /api/projects`, `GET/POST /api/phases`,
  `GET /api/phases/:id`, `POST /api/phases/:id/:action` where `:action` ∈
  `send_quote | approve_quote | reject_quote | mark_paid | start_work | deliver |
  accept | request_revision`.
- **Naming note:** this lifecycle object is called **Phase** everywhere in the
  product now — **Stage** is reserved for the deal pipeline
  (`CRM-RESTRUCTURE.md`). The table below (still labeled by its old name in a
  few places) describes Phase status.

---

## Design Tokens

### Color — base & brand
| Token | Hex | Use |
|---|---|---|
| Ink | `#16181D` | Primary text, primary buttons, sidebar bg, internal-only marker |
| Ink soft | `#3A3F47` | Secondary text |
| Muted | `#767B85` | Tertiary text / meta |
| Muted line | `#9AA0AA` | Mono labels, hints |
| Border | `#E7E8EC` / `#EDEDF1` / `#F2F3F5` | Card borders, row dividers (light→lighter) |
| Surface | `#F4F5F7` | Panels, chips |
| Surface soft | `#FBFBFC` / `#FAFAFB` | Rail/section backgrounds, internal-row tint |
| White | `#FFFFFF` | Cards |
| Cobalt (brand) | `#2B3EE6` | Brand mark facet, links, focus, lead-engineer avatar |
| Cobalt text | `#2536C4` | Brand text on light |
| Cobalt wash | `#EEF0FE` (border `#DDE1FB`) | Brand-tinted surfaces, client bubble |

> Primary action buttons are **Ink**, not cobalt — cobalt is reserved for brand
> moments, focus, and links (Stripe-style restraint).

### Color — semantic phase status (badge = soft tint bg + dark text + solid dot)
| Status | Dot / solid | Badge bg | Badge text |
|---|---|---|---|
| draft | `#6B7280` | `#F1F2F4` | `#4B5159` |
| quoted | `#2563EB` | `#E8EFFE` | `#1D4ED8` |
| approved | `#7C3AED` | `#F1EBFE` | `#6D28D9` |
| paid | `#0891B2` | `#E1F4F9` | `#0E7490` |
| in_progress | `#D97706` | `#FCEFDC` | `#B45309` |
| delivered | `#0D9488` | `#DCF3F0` | `#0F766E` |
| accepted | `#16A34A` | `#DCF5E3` | `#15803D` |
| needs_revision | `#DC2626` | `#FBE3E3` | `#B91C1C` |
| rejected | `#B91C1C` | `#F6DEDE` | `#991B1B` |

### Color — "waiting on" & visibility
- **Waiting on you:** bg `#FFF7ED`, text `#B45309`, border `#FADCB4`, dot `#EA8A0D`.
- **Waiting on Wahala:** bg `#F4F5F7`, text `#5A6069`, border `#E7E8EC`, dot `#9AA0AA`.
- **Client-visible:** bg `#EEF0FE`, text `#2536C4`.
- **Internal only:** bg `#16181D` (ink), text `#CFD2DA`, prefixed with `⊘`.

### Typography
- **Sans:** `Hanken Grotesk` (weights 400/500/600/700/800), system-ui fallback.
- **Mono:** `IBM Plex Mono` (400/500/600) — used for kicker/eyebrow labels
  (uppercase, letter-spacing ~`.12em`), IDs, breadcrumbs, timestamps, and meta.
- **Money:** Hanken Grotesk with `font-variant-numeric: tabular-nums`.
- Scale: Display 32–34/800 (`letter-spacing:-.025em`), Title 20–25/800,
  Subtitle 18–22/600, Body 14–15/400 (line-height ~1.6), Label 11/mono-caps,
  Micro 10–10.5/mono.

### Spacing, radius, elevation, focus
- **Spacing:** 4px base. Common: 8 / 10 / 14 / 18 / 22 / 30–36 (card padding).
- **Radius:** inputs & small buttons `8–9px`; cards/rows `10–12px`; outer frame
  cards `6px`; pills `999px`; modals `16px`; avatars `50%`.
- **Elevation (cards):** `0 1px 3px rgba(0,0,0,.08), 0 12px 40px -24px rgba(0,0,0,.18)`.
  Modal: `0 1px 3px rgba(0,0,0,.08), 0 24px 60px -24px rgba(0,0,0,.35)`.
- **Focus:** `2px solid #2B3EE6` border + `0 0 0 4px #EEF0FE` ring.
- **Active-row highlight:** `1.5px solid #C9D0FB` border + `0 0 0 3px #F3F5FF`.
- **Motion:** subtle only (≤150ms ease) — fades and small lifts, no flourish.

---

## Core Components (frame 01 — Foundations)
Build these as shared components first; every screen composes them.

- **StatusBadge** — the 9 statuses above. Pill: `padding:4px 11px 4px 9px`,
  `border-radius:999px`, `font:600 12.5px`, leading 7px dot. Status must be
  conveyed by **text + dot**, not color alone (WCAG AA).
- **Stepper** — the lifecycle: draft → quoted → approved → paid → in_progress →
  delivered → accepted (rejected / needs_revision are branches). 28px circles:
  completed = ink fill + white ✓; current = white + 2px status-colored border +
  `0 0 0 4px` wash ring + center dot; future = white + 1px `#D7D9DF` + grey number.
  A 2px track behind (`#E7E8EC`) with an ink progress segment to the current step.
  - **Responsive (required) — 7 labels collide on narrow screens.** Two modes
    keyed off the stepper's own width (container query, or a media query on the
    layout): **Wide (≥ ~640px):** full labeled stepper as above; nodes spaced with
    `justify-content:space-between`, each label column `min-width:0` with a small
    horizontal gap and 2-line `text-wrap` so adjacent labels never touch.
    **Narrow (< ~640px):** **drop the per-step text labels** and render just the 7
    dots + progress track, with a single caption line **"Step {n} of {total} ·
    {current state}"** (e.g. "Step 5 of 7 · In progress") above or below. This is the
    primary fix — don't shrink-to-fit all 7 labels. (Horizontal-scroll is an
    acceptable fallback but less preferred.) The compact dashboard-card stepper
    (frame 03) is effectively this narrow mode at small size. (See component note
    **C1 — Stepper · narrow fallback** on the canvas.)
- **ActionBar** — primary (Ink), secondary (white + `#D7D9DF` border),
  destructive (white + `#F0CACA` border + `#B91C1C` text), disabled
  (`#F1F2F4` bg, `#B4B9C1` text). **Render only the actions the server returns.**
- **Money** — tabular figures, e.g. `$8,500.00`.
- **HistoryTimeline** — actor (bold) + action, then mono `→ state · date, time`,
  with a status-colored node and connector line.
- **WaitingOn** indicator and **VisibilityMarker** (see token table).
- **PeopleCard / role chips / assignee avatars** — 30–34px circular initials.
  Account owner = ink avatar; lead engineer = cobalt avatar.
- **Lists/tables, empty states, forms + inline validation, toasts, ConfirmDialog**
  (for pay / accept / reject / send-over-threshold).

---
