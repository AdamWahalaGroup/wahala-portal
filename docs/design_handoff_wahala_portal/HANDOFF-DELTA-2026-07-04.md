# Handoff delta — demo-coherence pass · 04 Jul 2026

> Supplements [`README.md`](README.md) and [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md).
> The canvas in this folder (`Wahala Portal.dc.html`) is UPDATED — frames 35–37 are new
> (bottom band, next to 30–34). `Demo Script.dc.html` is the internal demo walkthrough
> (reference only — do not build it; it documents the canonical demo dataset).

## 1 · NEW screens to build

### Frame 35 — Invite to portal (modal)
The portal-invite moment, moved out of the retired Clients screen (frame 14) into the
deal→project handoff.
- **Triggers:** immediately after **Create project →** succeeds (frame 34), and any time
  from the Account page (frame 33) → Contacts → `+ add` / invite.
- Green success strip (project name · "N stages · Stage 1 Paid via deposit") · title
  "Invite {account} to the portal" · one row per contact: checkbox, avatar, name +
  mono email, **role select** (Client admin / Billing / Read-only). A contact with no
  email shows the amber dashed `⚠ add email to invite` chip (chip = input trigger,
  same as frame 33) and cannot be checked.
- Footer: secondary **Skip for now** + ink **Send portal invite →**. Caption: magic-link
  email · Invited → Accepted states (existing invite machinery from the old Clients
  flow — reuse it) · recipient lands on the client welcome (frame 15).

### Frame 36 — Quote approval (client, mobile) · `/dashboard/stages/[id]/approve`
Fills the `quoted → approved` gap (the approve *action* exists on the stage screen;
this is the dedicated review moment, mirroring frame 07's accept screen).
- 390px client-only screen: blue **"Quoted — your approval needed"** badge · scope
  paragraph · deliverables **grouped by epic** with empty (unchecked) tiles, labeled
  "What you get — the acceptance checklist later" · **Stage total · fixed price** row.
- Ink **Approve quote →** + secondary **Request changes** (opens a note form → message
  to Wahala, logged). Weighty confirm: "fixed price … logged against your name · you'll
  be asked to pay before work begins."
- Approval ≠ payment: after approving, route to the pay step (frame 08 when Stripe
  lands; today the stage simply shows Approved / awaiting payment).

### Frame 37 — Closeout → next deal (prompt)
Shown once to staff when a project's **final stage is accepted**; dismissible.
- Green strip "{project} — closed out · … accepted {date} · $X collected" · title
  "Propose the next deal on {account}?" · prefilled **Deal name** + **Est. value**
  (from the accepted roadmap/proposal when kind=paid_discovery) · cobalt chip
  **MSA on file · skips legal → SOW** when `accounts.msa_signed_at` is set.
- **Start deal → Discovery** creates a deal with `origin = spawned_from_project`
  (project_id) + logs the ↺ event on the account timeline (frame 33). **Not now**
  just dismisses (logged).

## 2 · CHANGED behavior / copy

- **Delete client → Archive account** (frame 14b redesigned): soft archive — hide from
  active lists, revoke portal access, delete NOTHING; admin-restorable. Type-to-confirm
  kept; button is ink, not red. Keep the old cascade delete as a dev-only script if
  needed — out of the product UI. (`DeleteClientButton` → archive action.)
- **Deposit = Stage 1's payment** (frame 34): when the deposit clears and the project is
  created, **Stage 1 is created in `paid` state** (payment record = the deposit invoice).
  Stages 2–3 follow the normal pay-gate. Copy on the drawer now says this explicitly.
- **Vocabulary:** deals move through **pipeline steps** ("pipeline step 5 of 5 —
  Committed"); only projects have **Stages**. Grep drawer/board copy for "stage".
- **Frame 14 (Clients) is superseded** — dimmed on the canvas. Accounts (frame 33) is
  the org destination; invites move to frame 35. Keep `/dashboard/clients` as a redirect.
- **Account header money** (frame 33): show `won $12k · committed $225k` — never a
  summed "lifetime" that double-counts open deals.
- **Staff sidebar unified** everywhere: Home · Sales · Accounts · Projects · Files ·
  Messages · Settings (frames 17, 31, 33 updated; apply to AppShell).
- Change-order caption (frame 05): client card-payment for change orders arrives with
  milestone billing; until then admin marks paid — say so in UI copy.

## 3 · Demo/seed dataset fixes (mirror in `drizzle/seed.sql`)

- **Ada Chen → Maya Chen** (`maya@meridian.co`) — one Ada in the product.
- **Northwind Ltd → Northwind Labs** (one account, one name).
- Frame 32's example account state: Meridian is `client`, not `prospect`.
- One coherent timeline: Meridian Mobile App **Stage 2 quoted 16 Jun · approved 17 Jun ·
  dashboard "awaiting payment" 29 Jun · paid 30 Jun 11:02 (Stripe) · work starts 30 Jun
  14:20**; Website Refresh Stage 1 delivered, accepted 29 Jun. Talden thread: capture
  02 May · discovery won 12 May · MSA 20 May · roadmap accepted 12 Jun · proposal
  24 Jun · Committed + deposit out 30 Jun. Full script in `Demo Script.dc.html`.
