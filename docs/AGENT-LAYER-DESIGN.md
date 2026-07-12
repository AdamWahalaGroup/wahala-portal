# The Agent Layer — design

*Distilled from Adam + Jason's session (11 Jul 2026). Round 1 lives on the
`agent-layer` branch. This doc is the shared vocabulary — read it before
arguing about architecture; then argue.*

---

## The questions we were circling, answered

**"Is it best to have an agent that's grounded to what's happening?"**
Yes — and grounding means the **database**, not a chat window. Everything an
agent needs to know is already recorded: `process_events` (append-only history
of every stage move, nudge, call, with readiness snapshots), the 10-field
discovery package with evidence, meetings and their reschedules, agreements and
deposit marks, the account's durable `aiContextMd`. Agents **read state and
write suggestions**. They never freewheel, and they never act on the outside
world (no client emails, no signatures) without a human clicking.

**"Is it an agent per swimlane? Agents that hand off the phases?"**
No. **One conductor per deal — "the pulse" — same code for every deal,
stage-aware behavior.** A swimlane agent would lose the deal's memory at every
handoff and fight its neighbors over boundaries. The phases aren't different
agents; they're different *behavior modes of the same conductor* (in Discovery
it pushes for the package fields; at Proposal-out it watches the silent clock;
at Committed it chases paper and deposit). The "handoff" already exists — it's
the `stage_moved` event.

**"Now that agent's running any time there's a project — is that stupid cost?"**
It's not running. **No resident processes.** State lives in D1; the conductor
is a cron tick plus event triggers (the Zoom-transcript webhook already works
exactly this way). The hourly pass is deterministic math — effectively free.
The AI passes are cents each and budget-capped per deal. A portfolio of 50
live deals costs single-digit dollars a month at mini-class model rates.
"He's not always running. It's a service. Woken up with a cron job." — that
was the right instinct, and it's the architecture.

**"This orchestrator is always the same for every project. Root directive:
nothing stalls."**
Correct — and it's half-built. The nudge cron already detects stuck deals,
silent proposals, and unaccepted opportunities against per-stage SLA windows
you can edit at Settings → SLAs & nudges, with owner escalation emails. The
pulse extends that engine; we are not building a second one.

**"We want a fuck-load of agents before we get to project."**
Agreed, and it's already true: the contact scout (with web recon) runs from
first contact, the discovery distiller and package extractor run all through
Discovery, the proposal and SOW writers at Proposal. The agent layer doesn't
start at project — it starts the moment a contact exists.

---

## Terminology (use these words)

| Term | Meaning |
|---|---|
| **Pulse** | The per-deal conductor. Not a process — a scheduled pass over one deal's grounded state. Emits scores + suggestions, respects the budget, escalates stalls. |
| **MMA** (Master Money Agent) | The one global agent ABOVE the pulses. Portfolio view: allocates attention + budget across deals (the knobs), owns the punt list, writes the Monday brief. Round 2. |
| **Micro-agents** | The task-specific fleet (scout, recon, discovery, extractor, proposal, SOW, taskgen, pulse). Cheap, narrow, admin-tunable per agent in Settings. |
| **Suggestion box** | Where agents talk to humans: per-deal list of concrete suggested actions. Humans do / dismiss. Agents never act outward themselves. |
| **Budget** | Real dollars of AI spend allowed per deal: "what's realistic to spend to get the check in the bank." |
| **Park** | The kill switch's landing state: agent spend frozen, deal loudly flagged with whose ball dropped. Humans revive or mark lost. Never auto-lost. |

---

## The three scores (+ the number that runs your week)

1. **Readiness (0–10)** — already live. Thoroughness of discovery: 10 package
   fields, ok/partial/missing. *"If our discovery call gets us to a 7, that's
   a high chance this is gonna be a winner."* It is a percentage of
   thoroughness, not of winning — we haven't won enough to know odds yet.

2. **Fit (0–10)** — NEW. The "value to the business" number from the
   whiteboard: form / fit / function / Wahala value. Is this deal *right for
   us* — margin potential, template reuse (our bonus money), tech fit, client
   quality, realistic timeline. AI-scored against a rubric, rationale shown,
   manually overridable. Refreshed by the pulse when stale or when the stage
   moves. This is NOT win probability and NOT deal size.

3. **Momentum (deterministic)** — days since last touch, meeting reschedules
   (three reschedules absolutely drops it), proposal-silent days. Computed
   from events, no AI, recomputed hourly.

**Priority = fit × value × stage-anchor × momentum-decay.** Deterministic,
cheap, recomputed hourly, and it answers the question no CRM answers:
*"Jason has 40 hours this week and 60 hours of people to talk to — who's
first?"* Not just the highest value; the best use of us. Surfaced as a
"Work this next" queue on Home, each entry carrying its ONE next action.

---

## Money: budgets, spend, the kill switch

- **Every AI run is recorded** — agent, model, tokens, cost in cents, what
  triggered it, which deal. The deal drawer shows *"agent spend $4.20 of $37
  budget."* We already compute the cost on every call today; we just throw it
  away. Stop throwing it away.
- **Budget per deal** = `max($2, 0.4% × deal value × stage win-anchor)`.
  A $30k deal in Discovery (25%) gets $30 of agent runway; the same deal at
  Committed (90%) gets $108. Spend scales with how real the money is.
- **At budget**: the pulse stops spending AI on that deal, says so once, and
  keeps doing the free deterministic checks. Humans can raise the budget.
- **The kill switch = the escalation ladder**, and it ends in **Park**, not
  Lost: suggestion → in-app nudge → named ball-drop (*"Jason dropped the ball:
  proposal unsigned 12 days"* — no matter whose ball: ours, the client's, the
  bank's) → "about to be parked" email → **PARK**: spend frozen, loud board
  treatment, alert. A human revives it or marks it lost (the post-mortem
  already writes itself). The system never buries a deal on its own.

---

## What we're building, in order

- **R1 (this branch):** the money meter (persist every AI run + spend chip),
  fit + priority scores, pulse v1 in the cron worker (hourly deterministic
  pass + daily AI pass), the suggestion box on the deal drawer, the Home
  "Work this next" queue.
- **R2 — MMA:** capacity model (hours per human per week), the knobs,
  punt list (fit below threshold → "this isn't for us," up to a stage cutoff),
  Monday brief that extends today's admin digest.
- **R3 — the full ladder:** park/revive flow, whose-court derivation,
  delivery-side stalls (`clientWaitingDays` is defined but unwired today),
  project-phase pulse with delivery thresholds.
- **R4 — pricing engine:** programmatic quotes — token/template-based cost
  model, speed multiplier (want the 20-week project in 10? price goes up),
  floor weeks (no project quotes under the floor, ever), template work priced
  at template cost. That margin is the bonus money.

## What we are NOT building (deliberately)

- **Zoom integration deepening** — copy/paste transcripts is fine; the
  Fable time goes to the algorithms. (Google Meet is already paid for.)
- **Agents that email clients autonomously** — they draft, humans send.
- **Auto-lost** — park, never bury.
- **VC anything.**

---

## R1 data model (for the engineers)

- `ai_runs` — every AI call: agent key, trigger (user/cron/webhook), deal /
  contact / org, model, tokens in/out, cost cents, timestamp.
- `suggestions` — the suggestion box: deal, agent, title, body markdown,
  status open/done/dismissed, resolver + timestamp.
- `deals` gains: `fitScore`, `fitRationaleMd`, `fitScoredAt`,
  `priorityScore`, `agentSpendCents` (running total).
- Pulse cadence: hourly cron = deterministic recompute (momentum, priority);
  daily cron = AI pass (fit refresh when stale/stage-moved, ≤3 suggestions per
  deal, budget-gated), then the existing nudge engine.
