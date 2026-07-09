# Handoff fix — Contacts page missing · 09 Jul 2026

> **QA finding from production, same day as the Opportunities restructure.** The founder
> created contacts (inline via New opportunity, and via New contact + account) and could
> not find them anywhere — "the contacts were not added." They WERE added: the records
> are in the database. **Delta §4 of
> [`HANDOFF-DELTA-2026-07-09-opportunities-restructure.md`](HANDOFF-DELTA-2026-07-09-opportunities-restructure.md)
> — "Contacts is a top-level nav page" — was not implemented.** This note is the fix spec.
> Visual reference: `Wahala Portal - Interactive v3 (Opportunities).dc.html` → sidebar →
> **Contacts** (list and detail screens).

## What is already correct (do not touch)

- `createOpportunity` and `createContactWithAccount` in `src/services/sales.ts` insert
  contacts correctly (inline creation, account linking, invite-on-create, audit rows).
- `listContactsLite(ctx)` exists and already promises "pickers + the Contacts page" in
  its docstring. `GET /api/contacts` already serves it.
- The contact detail drawer exists at `/dashboard/sales/contacts/[id]` (ContactWorkspace,
  scout panel, record editor, `+ Start opportunity` when no linked deal).
- The Account page contact union (`src/services/accounts.ts`) is correct.

## The gap

1. **No nav item.** `NAV` in `src/components/AppShell.tsx` has no Contacts entry.
2. **No list route.** There is no `src/app/dashboard/contacts/` (or equivalent) page;
   nothing in the UI ever renders the contact list. The only path to a contact is
   through a deal.
3. **Account-less contacts are unreachable.** The restructure's core rule — *a contact
   can stand alone* — is honored in the data model but not the UI: a contact with no
   account is on no Account page, and with no deal is on no board. Created → invisible.

## Fix spec

### 1 · Nav entry
Add **Contacts** to `NAV` in `AppShell.tsx`, staff-only, between **◆ Proposals** and
**Accounts** (matches the prototype order). No count badge.

### 2 · Contacts list page — `/dashboard/contacts`
Staff-only. Reuse `listContactsLite` (extend it — see §4) rather than a new query.
Layout per the prototype (max-width 1000px):

- **Header row:** `Contacts` (h1, 24px/800) left; ink **`+ New contact`** button right —
  opens the existing `NewContactModal` from `src/components/OpportunityModals.tsx`.
- **Intro line** (14px, `#5A6069`), exact copy:
  > People first. A contact can stand alone — an account only exists once at least one
  > contact hangs off it, and every opportunity starts from a contact.
- **Table** (white card, 1px `#EDEDF1` border, radius 11, header row `#FBFBFC` with mono
  10px uppercase `#9AA0AA` labels). Grid columns `1.4fr 1fr 110px 110px 16px`, gap 14,
  rows 13px 16px padding, 1px `#F2F3F5` dividers, whole row clickable:
  - **Contact** — 32px ink circle avatar (initials, white 11px/700) + name (13.5px/700)
    with a mono 10.5px `#9AA0AA` sub-line `{title} · {email}` (omit missing parts).
  - **Company** — account name; when the contact has no account render a muted
    "no account yet" treatment (mono, `#B4B9C1`), NOT a blank cell.
  - **Opportunities** — count of deals where `primaryContactId` = contact (mono,
    tabular). `—` when zero.
  - **Source** — mono 11px `#9AA0AA`.
  - Chevron `›` (`#C4C8CF`).
- **Row click** → the existing contact workspace. Simplest correct wiring: route to
  `/dashboard/sales/contacts/[id]` (the drawer-over-board). A dedicated full-width
  detail page under `/dashboard/contacts/[id]` (prototype shows one, with `← Contacts`
  breadcrumb, dossier + Opportunities card) is the ideal end state but NOT required for
  this fix — do not block on it.
- **Empty state** (real page, never blank — same rule as QA delta 07-08 §5): one line
  ("No contacts yet — every opportunity starts from one") + the `+ New contact` button.

### 3 · Post-create navigation
After `NewContactModal` succeeds, the "on record" confirmation's **Done** should land the
user somewhere the new contact is visible — refresh the Contacts list when opened from
it. Creation must never end on a surface where the created record can't be seen (that is
the exact bug reported).

### 4 · Service tweak
Extend `listContactsLite` (or add a `listContactsForPage`) to also return `title`,
`source`, and per-contact opportunity count (one grouped query over `deals.primaryContactId`).
Keep the lite shape for the pickers.

## Acceptance script (re-run of the founder's failing path)

1. Board → `+ New opportunity` → type an unknown name → `+ new contact "…"` → create.
   **✓ Contacts nav page lists the person** with the opportunity count = 1.
2. Contacts → `+ New contact` → name only, no account, no email → create.
   **✓ The person appears in the list** with "no account yet" and opportunities `—`,
   and their row opens the contact workspace with `+ Start opportunity`.
3. Contacts → row click → workspace opens; account link and deal link render when present.
