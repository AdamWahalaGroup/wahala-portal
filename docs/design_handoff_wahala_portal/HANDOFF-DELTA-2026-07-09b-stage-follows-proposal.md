# Handoff delta — Stage follows the proposal · 09 Jul 2026 (b)

> **NEWEST — read before any pipeline/proposals work.** Small, surgical change on top of
> [`HANDOFF-DELTA-2026-07-09-opportunities-restructure.md`](HANDOFF-DELTA-2026-07-09-opportunities-restructure.md).
> Found in end-to-end QA: you could click **"Move to Proposal out"** on a deal that had no
> proposal — the stage said "a proposal is out" while nothing was out. The stage lied.
> Fix: **the Proposal-out stage is event-driven, not a button.**

## 1 · Remove the manual "Move to Proposal out" action

- `DEAL_NEXT` no longer has a `discovery` entry. There is **no manual advance out of
  Discovery** — not in the deal drawer, not as a board drag target. If production still
  shows a "Move to Proposal out" button anywhere, that's the bug this delta removes.
- All other manual moves are unchanged: `new → discovery` ("Accept → start Discovery"),
  `proposal_out → negotiating`, `negotiating → committed`.

## 2 · Sending the proposal advances the deal

- On **Send** (proposal editor), if the deal's stage is `new` or `discovery`:
  set `stage = proposal_out`, reset `days_in_stage`, proposal `status = sent`,
  mint the share token. One event, one transaction.
  Toast: **"Sent — deal moved to \"Proposal out\""** (if no stage move was needed:
  "Sent — share link is live").
- Signing already worked this way (`proposal_out`/`negotiating → committed` on approve);
  this makes the whole spine consistent: **draft → send → sign each move the deal;
  buttons don't.**

## 3 · The readiness nudge moves to Send

- **Trigger (replaces frame 39's trigger):** clicking **Send** while
  `readiness_score < 7` and training mode on. There is no stage-drag trigger anymore
  because there is no stage drag.
- Modal copy updates:
  - Body: "…sending this proposal now risks a pitch built on gaps."
  - Recommendation card: **"Recommended: hold the send."** Schedule a follow-up call with
    the named decision-maker and fill the gaps — the draft keeps.
  - Footer buttons: cobalt primary **"Hold the send · stay in Discovery"** · ghost
    **"Send anyway"** · mono caption "the nudge is never a gate — overrides are logged
    to the deal".
- **Hold the send** → modal closes, proposal stays a Draft, deal stays in Discovery.
  Toast: "Held — the draft keeps, deal stays in Discovery".
- **Send anyway** → deal flagged `overridden`, then the full send path from §2 runs
  (status sent + auto-advance). `process_events` gets an `override` row exactly as
  before — only the moment it's recorded moves from stage-change to send.

## 4 · Deal drawer in Discovery

- The black advance button row is replaced (Discovery only) by a dashed hint chip:
  *"Sending the proposal moves this deal to Proposal out automatically."*
  **Mark lost** stays in the same row.
- "Next step" copy for Discovery: "Capture the discovery call — requirements included —
  then draft the proposal. Sending it moves this deal to Proposal out."
- "◆ Rough out a draft" / "+ Blank proposal" are unchanged and are now the only forward
  path out of Discovery.

## 5 · Data / metrics implications

- `process_events`: the nudge + override events now hang off the **proposal send
  attempt**, not a stage move. Keep the same event shapes; the scorecard's
  "Readiness at advance" column reads the readiness snapshot at send time for the
  Discovery→Proposal-out transition (identical semantics — send *is* the advance now).
- No schema change required; `deals.overridden` / readiness snapshots carry over.

## Supersession map

- `TRAINING-AND-SCORECARD.md` **frame 39** trigger + footer copy — superseded by §3
  (an inline note points here). Everything else in frame 39 (evidence quotes, layout,
  training-off inline variant) stands — the inline variant now renders on Send too.
- 09 Jul delta §1 line "Stage moves are still never gates; overrides are logged" — still
  true in spirit; the caption is now "the nudge is never a gate".
- `Production Walkthrough - Lead to Won.dc.html` (included) — **re-scripted**: step 4 is
  now "Draft & send the proposal"; it treats any surviving manual "Move to Proposal out"
  button in production as a disconnect, and moves the nudge check to Send.
- `Wahala Portal - Interactive v3 (Opportunities).dc.html` (included) — updated in place;
  still the primary reference prototype.
