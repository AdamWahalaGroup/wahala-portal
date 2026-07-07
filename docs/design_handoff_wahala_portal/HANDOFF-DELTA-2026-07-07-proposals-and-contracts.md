# Handoff delta — Proposals & Contract/SOW rebuild · 07 Jul 2026

> Supplements [`README.md`](README.md) and **supersedes [`sales/proposals.md`](sales/proposals.md)
> (frames 25–26) entirely.** Proposals are no longer a 2-option A/B artifact living in a deal
> drawer — they're a first-class, phased sign-off system with a linked Contract/SOW document.
>
> **Critical difference from every other file in this folder:** the reference for this delta is
> not the static canvas. It's **[`Wahala Portal - Interactive.dc.html`](Wahala%20Portal%20-%20Interactive.dc.html)**,
> a real interactive prototype — open it in a browser and click through it. Every behavior
> described below is live in that file (React-like component with real state, not just frames
> to look at). Read its logic class for the exact state shape, computed values, and handlers —
> treat the markdown below as an index into that file, not a replacement for reading it.

## 0 · Why this exists (context for the "why")

Wahala's real sales conversations showed two things the old A/B proposal design didn't support:
1. **Phased commercial structure is common and needs to be a first-class shape**, not a special
   case: one master signature up front, then each phase individually confirmed/amended in-app as
   the engagement reaches it — no re-signing DocuSign per phase.
2. **The proposal (the sales pitch) and the SOW/contract (the legal delivery document) are two
   different artifacts that serve two different moments**, even though they share the same
   underlying pricing data. The pitch needs to close fast; the SOW needs to be complete enough to
   sign and deliver against.

Everything below builds those two artifacts and the bridge between them.

## 1 · Data model

Each deal (`state.deals[]`) may carry a `proposal` object. This is new — it did not exist in the
CRM-RESTRUCTURE deal shape:

```js
deal.proposal = {
  version: 1,
  status: 'draft' | 'sent' | 'approved' | 'declined',
  complexity: 1-5,              // drives the amber "needs engineering review" flag when > 3
  complexityNote: '',           // shown only when complexity > 3
  execSummary: '',              // client-facing prose — see §4 for how AI drafts this
  options: [
    {
      id: 'A', label: 'A', name: '', price: 0, timelineNote: '',
      recommended: false,       // admin-set only — see §3.2, never auto-assigned
      phases: null,             // null = lump-sum option; [] or [...] = phased option
    },
    // ...N options, admin can add/remove (min 1)
  ],
  approvers: [{ name, role }],  // who on the client side can sign
  selectedOptionId: null,       // set once the client picks/signs
  respondedBy: null, respondedAt: null,
  shareToken: null,             // set on first send — public URL is /p/{shareToken}
  contract: { ... } | undefined // see §5 — only exists once "Generate contract/SOW" is clicked
}
```

Each phase inside an option: `{ name, amount, weeks, status: 'awaiting_amendment' | 'active' | 'done' }`.

`deal.discoveryNote` (new, sibling to `proposal`) is a short paragraph of what was actually
learned about the client's need during discovery. This is what the AI draft (§4) writes the
`execSummary` from — **never generate boilerplate about the drafting process itself** ("drafted
from the discovery package…") — the summary must read as real client-facing prose about their
actual problem. See the `deal_harbor_marina` / `deal_harbor_pos` seed entries for the pattern.

## 2 · Navigation & list

- **Proposals** is a first-class staff nav item (`staffNavConfig`), not buried in the deal
  drawer — badge shows count of proposals with `status: 'sent'` (awaiting response).
  - Nav item icon: `◆`. Placed between Sales and Accounts.
- `/dashboard/sales/proposals` — flat list, one row per deal with a proposal: name, account,
  value (recommended/chosen option's price), status pill, complexity chip (`◆ C{n}/5`, amber
  background when > 3, else cobalt-wash).
- The deal drawer (Sales pipeline) still surfaces a proposal shortcut when one exists ("◆ View
  full proposal → {status}"), and when a deal has **no** proposal yet, shows two creation paths
  side by side (see §3.1): "◆ Rough out a draft" (AI) and "+ Blank proposal" (manual). **Both
  paths must exist — do not make AI drafting the only way to start a proposal.**

## 3 · Proposal editor (`/dashboard/sales/proposals/[id]`)

Two-column layout: dark phase spine (left, fixed ~220px) + main content (right, scrollable).

### Left spine
Vertical stepper: **Master signature** (dot: grey not-sent / cobalt sent-awaiting / green sealed
once approved) → one row per phase of the **currently chosen/recommended option**, each showing
name, amount, weeks, and a status note (`active now` / `delivered` / `awaits amendment`). Once
the proposal is **approved**, phases beyond the first show an **"Activate & amend →"** link; click
opens an inline two-button confirm ("Cancel" / "Confirm") — confirming flips that phase to
`active`, the previous one to `done`, and logs the amendment **without requiring a new signature**.
This is the core phased sign-off mechanic — implement it exactly, it's the product's main
differentiator per the founders' own description of the model.

Eligible approvers list at the bottom of the spine (name + role, sourced from `proposal.approvers`).

### Main content
- Header: account · version · status pill · complexity pill (`◆ Cn/5`, plus " · fast-track" when
  ≤3). **Complexity is admin-adjustable while in Draft** via 5 clickable dots, not just an AI
  output — the AI setup wizard (§4) proposes a starting value based on deal size, but it's not
  locked.
- Amber "Needs engineering review" card shown only when `complexity > 3`.
- Executive summary — textarea while Draft, static text once Sent/Approved/Declined (**never
  render both the input and the static text at once for the same status** — that was a real bug
  we hit: gate the two branches on opposite booleans, e.g. `isDraft` / `isLocked = !isDraft`,
  not the same boolean twice).
- Share-link card once sent (`wahala.co/p/{shareToken}`).
- Approved/declined banners with who + when.

### 3.1 · Creating a proposal — two paths, always both available
1. **"◆ Rough out a draft"** opens a small setup modal first — *"Before I draft this"* — asking
   **one real question**: how many pricing paths (Just the number / Standard vs. phased /
   Good-better-best), plus an optional free-text "anything I should weight" note. Confirming
   drafts option shapes and phase splits sized off `deal.value`, and an `execSummary` built from
   `deal.discoveryNote` (see §1 — must read as real prose, not process narration). **No option
   starts pre-marked recommended** — see §3.2.
2. **"+ Blank proposal"** creates two empty options (A, B) with blank name/price/timeline and no
   recommendation, and drops straight into the editor for full manual entry. Every field must be
   editable inline (see §3.2) — a blank proposal that can't be filled in is a dead end.

### 3.2 · Options — while Draft
- Inline-editable: option name, price, timeline note (plain `<input>`s, no separate save step —
  live state updates as the rest of this app already does).
- **"+ Add option"** appends a new option (next unused letter A–H); **"✕"** removes one (disabled
  once only 1 option remains — never allow zero options).
- **Recommended is admin-chosen, never automatic.** Clicking "Mark recommended" on an option sets
  it recommended and un-marks any other; clicking the green "RECOMMENDED" badge on an
  already-recommended option **toggles it back off** — it is valid and expected to have zero
  recommended options. Do not default any option (including a freshly re-added one) to
  recommended.
- Phased options (`phases !== null`) show an editable phase list (name / $ / weeks per row,
  "✕" to remove a row, "+ Add phase" to append). Lump-sum options (`phases === null`) show none.

### 3.3 · Public proposal page (`/p/{shareToken}`, no login, client-facing, mobile-first)
Phone-frame in this prototype is simulated as a centered modal; in production this is its own
route. Ink header, mono "PROPOSAL · v{n} · prepared for {account}". Exec summary. Option tiles
(tap to select). "Type your full name to sign" → **Sign & approve** (disabled until name is
non-empty) or **Decline**. On sign: transitions to a **"Signed & sealed"** takeover — dark card,
green check, who signed + when, and a **"what just unlocked"** list (deal moves to the
**Committed** stage — this is deliberately not "Negotiating"; Committed is where the agreement
package + deposit collection already live, and the takeover copy ("deal moves to Contract room")
refers to Committed, not a separate stage), Phase 1 goes active, phases 2+ shown as dormant
"awaits amendment"). This moment should feel like
an accomplishment, not a form confirmation — per the founders' explicit ask that state changes
feel earned, not just logged.

### 3.4 · Deleting a proposal
"Delete proposal" (red text link, bottom-right of the action row) → confirm modal ("This can't be
undone") → clears `deal.proposal` entirely and returns to the Proposals list.

## 4 · AI drafting setup modal

Triggered by "◆ Rough out a draft". Do not skip straight to generation — the modal exists because
a veteran salesperson makes one real judgment call before drafting (how many paths to show the
client), and an optional context note. See `openAISetup` / `confirmAISetup` in the logic class for
the exact option-shape math per path-count choice (1 / 2 / 3).

## 5 · Contract / SOW (`/dashboard/sales/proposals/[id]/contract`, staff-only)

This is the biggest structural addition and the one most likely to need real backend work
(document generation, e-signature integration, PDF export). It is a **separate, linked artifact**
generated from the proposal — not a rewrite of the proposal editor. See the actual Talden SOW
document (`docs/Proposal-for-Service.txt` in the main repo) for the real reference this was built
from — the payment-schedule math in this feature matches that document's numbers exactly
($22,500 deposit / $42,500 + $95,000 + $65,000 phase payments / $225,000 total) and should be
spot-checked against it.

### 5.1 · Generation
"◆ Generate contract / SOW" button in the proposal editor's action row (only shown once; becomes
"View contract / SOW →" after). Generating takes a **one-time snapshot** of the chosen (or
recommended, or first) option's phases into `proposal.contract`:

```js
deal.proposal.contract = {
  status: 'draft' | 'sent' | 'executed',
  proposalNumber: 'WG-2026-NNN',
  scopeOfEngagement: '...',              // editable boilerplate
  phases: [{ name, amount, weeks, objective, scopeText, deliverablesText, acceptanceText }],
  depositPct: 10,
  outOfScopeEnabled: bool,               // default ON when complexity > 3, else OFF
  outOfScopeText: '...',
  changeManagementEnabled: bool,         // same default rule as outOfScopeEnabled
  changeManagementText: '...',
  acceptanceReviewDays: 5,
  clientSignerName, clientSignerTitle, ourSignerName, ourSignerTitle,
  sourceOptionId, sourceSignature,       // for staleness detection, see §5.4
  amendments: [{ note, at }],            // only appended to once status === 'executed'
}
```

**Why complexity drives the Out-of-Scope/Change-Management defaults**: a $9.5k lump-sum job
doesn't need a formal change-order clause; a $225k multi-phase platform build does. Reuse the
proposal's existing complexity score rather than a blind on/off toggle.

### 5.2 · Sections (in order)
1. **Scope of Engagement** — one editable paragraph.
2. **Statement of Work** — one card per phase (or one card for a lump-sum option): Objective
   (single-line input), Scope of work / Deliverables / Acceptance criteria (each a "one item per
   line" plain textarea — **do not build nested add/remove-row bullet UI for these**; a flat
   textarea is the intentionally lean choice here — see §5.5 for the reasoning already settled
   with the founder). Phase **price and weeks are directly editable inputs on this page** —
   once a contract exists, its numbers are its own; see §5.4 for how this interacts with edits
   made back in the proposal.
3. **Project Timeline** — 3-column table: Phase name (prefixed "Phase N — " when multi-phase) ·
   Duration · Price. Totals row.
4. **Payment Schedule** — Contract Execution (deposit, = `depositPct%` of total, editable %) +
   one row per phase ("Phase N Acceptance — {name}"; **first phase's amount is reduced by the
   deposit already collected**, every other phase pays in full at its own acceptance) + Total row.
5. **Out of Scope** — toggle (on/off pill, click to flip) + textarea, only rendered when enabled.
6. **Change Management** — same toggle pattern.
7. **Acceptance** — review-days number input + one generated sentence using it + the client name.
8. **Signatures** — two columns (client / Wahala Group), name + title inputs, a plain-text
   "Signature ________ Date ________" line (no real e-sign capture in this prototype — that's a
   real backend integration point, likely DocuSign per the founders' existing process).

### 5.3 · Status lifecycle — Draft → Sent for signature → Executed
This mirrors the proposal's own draft/locked pattern, and is the answer we landed on after
explicitly weighing (and rejecting) a generic "Edit/Save toggle": a contract's real distinction
isn't an editing session, it's **draft vs. executed**. Implement exactly this:
- **Draft**: every field above is live-editable, autosaves on input (no Save button — consistent
  with every other editable surface in this product).
  "Mark sent for signature →" advances to `sent`.
- **Sent for signature**: the entire body (everything in §5.2) is locked — read-only, visually
  dimmed. "✓ Mark executed" advances to `executed`; "Revert to draft" is available as an escape
  hatch if it was sent by mistake.
- **Executed**: body stays locked permanently. An **Amendment log** section appears below the
  Signatures block — a plain running list of `{note, timestamp}` entries plus a small form to add
  a new one. **Do not unlock the document fields to record a change** — a real change order is a
  new logged entry, not a silent edit to the executed original. This is intentional and matches
  the document's own Change Management clause.

Implementation note: lock the section visually/interactively with a single wrapping container
(`pointer-events:none` + reduced opacity) rather than threading a `readOnly` prop through every
field individually — much less error-prone, and is what the working prototype does.

### 5.4 · Staleness detection & resync
If the proposal's chosen option or its phase structure (name/amount/weeks) changes **after** the
contract was generated, the contract page shows an amber banner — *"The proposal has changed
since this was generated"* — with a **"Resync phases"** action. Resyncing rebuilds the phase list
from the current proposal data while **preserving any Objective/Scope/Deliverables/Acceptance text
already written** for phases that still exist (matched by name). This banner only applies while
the contract is in `Draft` status — once Sent/Executed, staleness no longer matters (the contract
has already diverged into its own document by design, see §5.3).

### 5.5 · Deliberate scope decisions (don't relitigate these without cause)
- **No drag-and-drop section builder.** The section list (Summary → Scope → SOW-per-phase →
  Timeline → Payment → Out-of-scope → Change-mgmt → Acceptance → Signatures) is a fixed, ordered
  template — what varies deal-to-deal is whether a section is *needed*, not its position. Toggles
  solve that; drag-and-drop would solve a problem that doesn't really exist here and would hurt
  document consistency.
- **Bullet lists (Scope of work / Deliverables / Acceptance criteria) are flat "one per line"
  textareas**, not nested add/remove-row lists. This was a deliberate simplicity call for the
  admin-facing SOW editor, not an oversight.
- **The pricing proposal and the Contract/SOW are two separate documents/pages**, sharing data
  only at generation time (a snapshot, not a live binding) — do not merge them into one screen.

## 6 · Known contrast bug pattern — check for it everywhere you touch this feature
Every button/input/textarea added during this build originally shipped **without an explicit
`color` CSS property**, relying on inheritance that didn't hold up — text rendered low-contrast
or effectively invisible until selected. All instances in the current file are fixed (explicit
`color` + `background` on every interactive element), but if you extend this feature, **always
set `color` explicitly on new buttons/inputs/textareas** rather than relying on inheritance.

## 7 · Files in this delta
- `Wahala Portal - Interactive.dc.html` — **the real interactive prototype**, the primary
  reference for this entire delta. Open it in a browser; click through Proposals → an existing
  deal → generate a contract → change its status → log an amendment.
- This file (`HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md`).

`sales/proposals.md` (frames 25–26 on the old static canvas) is now stale for the Proposals
feature — do not use it as a reference for anything described above.
