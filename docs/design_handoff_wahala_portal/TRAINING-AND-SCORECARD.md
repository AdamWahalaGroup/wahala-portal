# Training mode & process scorecard — frames 38–41

> Supplements [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md) (read that first — object model,
> 5-stage pipeline, gates vs. stages). The canvas in this folder is UPDATED — frames
> 38–41 are the new bottom band. Source material: `docs/brain_storming/synthesis.md`
> and the good/bad discovery-call fixtures in `docs/brain_storming/` (repo).

## The one idea

Guidance and measurement are the same feature. A single **process model** knows, for any
deal, what should happen next (given its pipeline step, gates passed, time elapsed, and
Discovery Package completeness). Pointed forward it *guides* (training mode); pointed at
elapsed history it *measures* (nudges, post-mortems, scorecard). Build the model once;
render it three ways.

**Non-negotiable:** pipeline steps are dispositions — the portal NEVER blocks a move.
Only gates block (no payment before contract, no engineering before contract). Every
guidance surface below can be overridden; overrides are **logged, never prevented**.

## Data model (additions)

- `deals.readiness_score` (0–10, one decimal) — AI-computed after every call/artifact,
  from Discovery Package completeness. Recompute, don't mutate history: store per-event
  snapshots so "readiness at advance" is queryable.
- `discovery_packages` — one per deal. Fields (each: status ✓/–/✕, source ref →
  call transcript + offset): business_profile, current_workflow, pain_points,
  budget_posture, decision_makers, success_metrics, mvp_priorities, timeline,
  customer_terminology, deferred_scope.
- `process_events` — append-only log: stage moves, nudges fired, nudge outcomes
  (acted / ignored / overridden), overrides with actor + readiness at that moment.
  This table feeds frames 40 and 41 entirely.
- `users.training_mode` (bool) — self-toggleable in Settings; owners can set it for
  others. Default ON for new admins.

## Frame 38 — Deal view · Training mode ON

Training mode is a **layer on the real deal view, never a parallel UI**. With the toggle
off, the same screen renders without the cobalt guidance elements — nothing moves.

- **Sidebar card:** cobalt-dashed "Training mode" card with mini-toggle above the user
  chip. Caption: "guides the process · logs to your scorecard" (be honest that it's
  measured).
- **Goal rail** (top, `#EEF0FE` bg, `#DDE1FB` border-bottom): TRAINING chip + current
  goal sentence + right-aligned mono step tracker ("step 4 of 6 · lead → discovery →
  **you are here** → …"). Goal is derived from the process model (next expected
  milestone + SLA date), not hand-set.
- **Discovery package card** (cobalt 1.5px border): 2-col checklist of the 10 package
  fields; each row = green ✓ / amber – circle, bold field name, mono provenance line
  ("420 wet slips · 260 dry · 65 staff · call 1"). Provenance links to the transcript
  moment. Header pill: `READY 8.7/10` (green ≥7, amber 4–7, red <4).
- **Explain callouts:** cobalt `?` circle + one short paragraph. Two placements: under
  the stage chip (stages vs. gates) and under the checklist (why completeness matters —
  the "we said it would take two days" scar). Copy source of truth = the glossary in
  `synthesis.md`; render the same strings everywhere (these become tooltips when
  training mode is off).
- **Next best action card** (ink `#16181D` bg): numbered 1/2/3 — active step has cobalt
  number chip + white text; later steps muted. Content is generated from the process
  model (here: draft Option A/B → estimator review if complexity > 3.0 → send, no
  deposit).
- **Recorded calls card:** per call — green dot, title, mono meta (date · duration ·
  "9 fields extracted"), `transcript →` link.

## Frame 39 — Training nudge · not proposal-ready (modal)

> **⚠ 09 Jul (b):** trigger + footer superseded by
> [`HANDOFF-DELTA-2026-07-09b-stage-follows-proposal.md`](HANDOFF-DELTA-2026-07-09b-stage-follows-proposal.md) §3 —
> there is no manual move to Proposal out anymore; the nudge fires on proposal **Send**
> (buttons: "Hold the send · stay in Discovery" / "Send anyway"). Layout, evidence quotes,
> and the training-off inline variant below still stand.

- **Trigger (superseded, see note):** a deal is dragged to **Proposal out** (or "Draft proposal" clicked) while
  `readiness_score < 7`. Training mode makes it a modal; with training off it's a
  one-line inline warning on the drop — same logic, quieter chrome.
- Amber header strip: ⚠ tile, "Hold on — this deal isn't proposal-ready", mono context
  line, red `READINESS 3.1/10` pill.
- Body: 1 sentence of why; then a bordered list of the failed checks — each row red ✕ +
  bold check name + evidence **quoted from the transcript** ("depends who answers the
  phone", "we'd see what it costs first", "just… better"). Quotes are what make the
  nudge persuasive; don't paraphrase.
- Cobalt recommendation card: `?` + "Recommended: stay in Discovery" + concrete next
  action (workshop with named roles, pre-meeting questionnaire).
- Footer: cobalt primary **Keep in Discovery · schedule workshop** · ghost **Advance
  anyway** · mono caption "stages are never gates — overrides are logged to the deal".
  Advance anyway → move happens immediately, `process_events` gets an `override` row.

## Frame 40 — Deal post-mortem (auto-generated on Lost)

- Generated when a deal is dropped on **Lost** (loss reason is required at drop, see
  frame 31). Attached to the deal + account timeline; linked from the scorecard.
- Header: deal name + red LOST pill; mono meta (value · owner · days lead→lost ·
  reason). "auto post-mortem · {date}" top-right.
- **Actual vs. expected timeline:** the account-page timeline pattern (dot + rail), one
  node per stage move/silence window. Node color = health (green/amber/red). Under any
  node where actuals diverged from the process model, a mono amber line: "⚠ decision
  maker never identified — expected before proposal", "⚠ readiness nudge overridden",
  "⚠ expected follow-up within 5 days of sending".
- **"What could have gone better"** (ink card): max 3 numbered findings, written as
  cause → consequence → counterfactual. Footer mono line: where it was logged + any
  cross-deal pattern detected ("2nd single-option proposal this quarter").

## Frame 41 — Admin scorecard · `/dashboard/sales/team` (owners only)

- Sales sub-nav gains **Team** (Board / Funnel / Team). Route is owner-gated.
- Header copy sets the intent: "Outcomes lag; process health leads."
- **One row card per admin**, 7-col grid: identity (avatar, name, open deals + value) ·
  **Won/lost** (+win %) · **Readiness at advance** (avg score when they moved deals
  forward; 0–10 + thin bar, green ≥7 amber <7) · **Nudge response** (% acted on; bar) ·
  **Overrides** (count + mono qualifier: "justified · won" / "2 preceded losses") ·
  **Avg days stuck** per stage · **Signal chip** (green ▲ top performer / amber ⚠
  pattern / cobalt ↗ ramping).
- A user in training mode gets the cobalt-dashed row treatment + TRAINING chip.
- **Signals band** (bottom, 2-up): amber and green insight cards. Each names the person,
  the measurable pattern, and a suggested Monday-meeting question or action ("suggest
  turning training mode off next month"). Max 2 — this is a conversation starter, not a
  surveillance wall.
- Scorecard math comes only from `process_events` — no gut-feel fields.

## Seed data (mirror in `drizzle/seed.sql`)

- **Kai Udo** (`kai@wahala.group`) — third admin, month 2, `training_mode = true`.
- **Harbor Point Marina** account (Bob Ross, `bob@harborpointmarina.com`) — deal
  "Harbor Point — marina ops platform", Discovery, $140–220k, owner Kai. Two recorded
  calls (Jul 3 · 1h12m, Jul 17 · 58m) with the Discovery Package fields as shown on
  frame 38; readiness 8.7. The bad Jul 10 follow-up (readiness 3.1) is the nudge
  fixture for frame 39. Transcripts: `docs/brain_storming/` good/bad `.docx` fixtures.
- **Vega — mobile rebuild** ($48k, Jason) — Lost Jul 2, "went with cheaper vendor";
  post-mortem per frame 40 (readiness 5.8 at advance, 3 ignored nudges, single-option
  proposal, day-34 loss).
- Scorecard quarter stats per frame 41 (Ada 5/1 · 8.2 · 94% · 1; Jason 2/2 · 6.4 ·
  61% · 3; Kai 1/0 · 7.5 · 88% · 0).
