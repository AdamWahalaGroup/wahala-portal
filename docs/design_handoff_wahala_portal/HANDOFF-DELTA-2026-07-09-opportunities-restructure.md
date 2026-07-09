# Handoff delta — Opportunities restructure · 09 Jul 2026

> **NEWEST — read before any sales/CRM work.** Supersedes the Triage/capture model in
> [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md) (frames 30–32) and the "lead" vocabulary
> everywhere. The reference is a full interactive prototype:
> **`Wahala Portal - Interactive v3 (Opportunities).dc.html`** — open it in a browser and
> click through it (role switcher top-right, training mode in the sidebar). It covers the
> whole staff app: board, contacts, accounts, proposals (new Signed-Spine editor), contract,
> projects, client portal. Where v3 and older docs/prototypes disagree, **v3 wins**.

## 1 · "Lead" and "Triage" are retired — one pipeline

- Sidebar nav item is now **Opportunities** (was Sales). Board columns:
  **New → Discovery → Proposal out → Negotiating → Committed**
  (weighted probabilities 10 / 25 / 55 / 75 / 90).
- An **opportunity is not a new object** — it is the deal record at stage `new`. There is no
  separate lead entity and no Triage column of contacts. Cards carry a badge:
  `◔ OPPORTUNITY` (blue `#eef0fe`/`#2536c4`) while stage is `new`, `◭ DEAL`
  (purple `#f1ecfd`/`#6d28d9`) after.
- Primary action on a new opportunity: **"Accept → start Discovery"** — same record, stage
  flips, badge flips. Board/list toggle unchanged. Stage moves are still never gates;
  overrides are logged to the deal.
- Staff Home "Needs attention" now includes **"N new opportunities to accept"** (routes to
  the board), alongside stuck deals and proposals awaiting signature.

## 2 · People-first object model

- **A contact can stand alone** (`account_id` nullable). An account only exists once at
  least one contact hangs off it. Every opportunity is attached to a **contact** from day
  one; the account is optional at creation.
- **Account-less opportunity won:** the account is born at **Create project →** — created
  from the contact's name, the contact is linked and becomes primary, the deal is re-linked.
  Nothing entered earlier is ever re-typed (same principle as the 08 Jul delta §1).

## 3 · Entry points (replaces the "Capture contact" modal)

**New opportunity** modal (from the Opportunities board, or "+ Start opportunity" on a
contact):
- Contact: pick an existing contact **or create one inline** (name + email).
- Account: existing / "+ create new" / none.
- **"What do they need"** textarea — seeds the opportunity name (account-or-contact name +
  first ~36 chars of the need) and the account dossier.
- Est. value, Source (inbound / referral / conference / cold outreach / …).
- Create → card lands in **New** with the `◔ OPPORTUNITY` badge. Toast: *"Opportunity
  created — accept it to start the deal."*

**New contact + account** modal (from Contacts): creates the person and their company with
**no opportunity** — "start an opportunity from them any time". In-modal note (exact copy):

> ✉ If there's an email, a portal invitation goes out on create. Next: due diligence on the
> account page, then start an opportunity when you know enough.

⚠ **This reverses 08 Jul delta §3** ("no portal invite before project creation") for this
deliberate-creation path. Rationale in the model: contact creation is no longer napkin
capture — it's an intentional record. The §3 acceptance automation still applies unchanged:
accepting an invite links the login to the existing contact by email, no duplicate person
records, first accepted invitee becomes primary if none exists.

## 4 · Contacts is a top-level nav page (new)

- **Contacts list:** columns Contact / Company / Opportunities / Source. "+ New contact"
  opens the contact+account modal.
- **Contact detail:** header with "+ Start opportunity", account link/select, and an
  **Opportunities** card listing the contact's deals (stage dot + label + value, click →
  deal drawer).

## 5 · Qualification chips move to the account dossier

The 2-of-3 chips (real need · budget signal · decision-maker) no longer live in a capture
modal — they sit on the **Account page dossier** with **"Start deal → Discovery"** (disabled
until name + 2 of 3 checked). This is the due-diligence path: create contact → research on
the account page → start the deal directly into Discovery.

## 6 · Proposals belong to deals

- The **Proposals** nav page is a **document list** (proposal / status / deal), not a
  pipeline. Row click opens the editor; **new proposals start from a deal on the board** —
  "◆ Rough out a draft" in the deal drawer. One signature covers the engagement.
- Statuses: Draft / Sent / Approved / Declined.

## 7 · Proposal editor — the "Signed Spine"

The editor (and public page) adopted the Signed-Spine direction explored on 09 Jul:
- Dark left rail (`#16181d`, 220px) labeled **"Phased agreement"**: a **Master signature**
  node on top (sub-state: "DocuSign · sealed" / "awaiting signature" / "not yet sent"), then
  one node per phase — the ceremonial spine of the phased sign-off model from the 07 Jul
  delta.
- Public proposal approved state: dark **"Signed & sealed"** banner — "{name} approved
  Option {A/B}" · "{date} · master signature on file". Decline is a small underlined text
  link under the sign box.
- Everything else from the 07 Jul proposals/contract delta (options, phased sign-off,
  linked Contract/SOW with Draft→Sent→Executed lock, staleness/resync) carries forward —
  v3 contains the current build of all of it.

## 8 · Training-mode "How it fits" strip

With training mode on, sales/CRM pages show a strip mapping the object chain, current step
highlighted, with a per-step hint:
- **Contact + Account** — "people first — a contact can stand alone; an account always hangs off at least one contact"
- **Opportunity** — "a possible sale on a contact — accept it into Discovery to start the deal"
- **Deal** →
- **Proposal** — "the document a deal sends out — one signature covers the engagement"
- **Project** — "delivery work on a deal, one to one — internal until shared or the deal is won"

## Vocabulary (update everywhere)

| Old | New |
|---|---|
| Lead / napkin lead | **Opportunity** (deal at stage `new`) |
| Triage column (contacts) | **New** column (opportunities) |
| Qualify / Pass | **Accept → start Discovery** / decline |
| Capture contact modal | **New opportunity** / **New contact + account** modals |
| Sales (nav) | **Opportunities** (nav) |

## Supersession map

- `CRM-RESTRUCTURE.md` §§ on Triage, capture modal, contact qualification-as-pipeline
  (frames 30–32) — **superseded**. The Contact/Account object model, account page, deal
  drawer, agreement checklist, and deal→project loop still stand (with new vocabulary).
- 08 Jul delta §1–§2 — **absorbed**: the carry-everything principle now flows through the
  New-opportunity modal; there is no qualify-time account picker because there is no
  qualify step.
- 08 Jul delta §3 — **partially reversed** (see §3 above). §4 (invite state ≠ sales state,
  two chips on one row) and §5 (no dead client nav) still stand.
- `Wahala Portal - Interactive.dc.html` — updated copy included (08 Jul QA fixes), but for
  sales/CRM/proposals it is **historical**; use v3.
- `Production Walkthrough - Lead to Won.dc.html` (included, printable) — the QA script the
  founder ran against production on 08 Jul. It is written against the **pre-restructure**
  flow (Capture contact → Triage → Qualify); re-script it after this restructure ships.

## Not in this bundle

An intermediate exploration ("Leads Inbox" — a separate lightweight leads scratchpad,
`…Interactive v2…` in the design project) was considered and set aside in favor of the
single-pipeline model above. A proposal-editor options exploration
(`Proposal Focus - Options.dc.html`) fed §7.
