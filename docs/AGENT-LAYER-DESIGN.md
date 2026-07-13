# Deal Pulse and AI operating design

> Distilled from Adam and Jason's 11 July 2026 session and reconciled with the
> operating model on 13 July 2026. Deal Pulse R1 is implemented. Its formulas,
> thresholds, and cost assumptions are experiments until real outcomes calibrate
> them.

## Architecture

Deal Pulse is one stage-aware conductor over each Deal, not a collection of
resident processes or one autonomous agent per stage. State lives in D1. An
hourly scheduled pass performs deterministic checks, while bounded AI work runs
less often and only when configuration, freshness, and budget allow it.

Grounding means current database state: events, discovery evidence, meetings,
commercial records, account context, and the explicit agreed follow-up. AI reads
that state and writes drafts or suggestions. A human remains responsible for
client communication and commercial actions.

Discovery uses one evidence-ingestion workflow. A transcript or set of meeting
notes produces a pending analysis containing a proposed long-form memo,
Solution-clarity evidence, buying-path evidence, commercial
classifications, and—only with explicit source evidence—a proposed agreed
follow-up. The Deal does not change until a staff member reviews the proposal
and applies selected items. Commercial classifications and follow-ups are
always unselected by default; AI must never silently decide IP ownership,
engagement shape, delivery model, support obligations, data risk, or a human
commitment.

Task-specific AI tools may support contact research, discovery extraction,
proposal/SOW drafting, and delivery task breakdown. They share the same safety
boundary; adding more agent names does not grant more authority.

## Vocabulary

| Term | Meaning |
|---|---|
| Deal Pulse | Scheduled evaluation of one Deal's grounded state. |
| Task-specific tool | A narrow AI workflow such as discovery extraction or proposal drafting. |
| Suggestion | A proposed human action that can be completed or dismissed. |
| AI budget | A configurable cap on recorded model spend for a Deal. |
| Park | A possible future human-controlled state that freezes AI spend without marking a Deal lost. |
| Portfolio brief | A possible deterministic summary across Deals. Automatic allocation and punt decisions are parked. |

## Independent signals

1. **Solution clarity (0–10)** measures how complete and evidenced the eight
   solution fields are. It answers whether Wahala can scope and price
   responsibly; it is not win probability.
2. **Buying path (Unverified / Developing / Confirmed)** tracks champion,
   economic buyer, compelling event, decision process, and funding path. It
   answers whether the customer can credibly purchase; it is not folded into
   solution clarity.
3. **Wahala fit (0–10)** estimates whether the work is attractive to Wahala,
   considering technical fit, client quality, delivery risk, margin potential,
   and reusable IP. AI supplies a rationale and a human may override it.
4. **Engagement health** is deterministic. It reflects human touches, silence,
   and meeting reschedules. The database currently retains the internal field
   name `momentumScore` for compatibility.
5. **Action urgency** is deterministic. Missing, overdue, and due-today agreed
   follow-ups rise above future follow-ups. A scheduled meeting counts when no
   separate action is recorded.
6. **Portfolio attractiveness** combines fit, value, and a stage anchor. It is a
   relative attention signal, not forecast probability.

The Home queue sorts action urgency first and portfolio attractiveness only as a
tie-breaker. A neglected Deal must become more visible, not disappear because
its engagement health declined.

## Cost control

Every supported AI run records the agent key, model, trigger, Deal/account
linkage, token usage, estimated cost, and timestamp. The current budget cap is:

```text
max($2, 0.4% × deal value × stage anchor)
```

This is an uncalibrated safety limit, not a recommended level of spend or a
pricing formula. At the cap, AI work stops for the Deal while deterministic
checks continue. Humans may adjust the budget deliberately.

Actual portfolio cost must be read from recorded runs. Do not claim a monthly
cost before usage data supports it.

## Implemented R1

- one-pass discovery evidence analysis with item-level human review
- pending, applied, and dismissed analysis status on recorded calls
- explicit acceptance before discovery, qualification, or commercial Deal data changes
- AI-run ledger and per-Deal spend total
- Wahala fit rationale and portfolio-attractiveness score
- deterministic engagement-health and action-urgency refresh
- stage-aware, budget-gated AI suggestions
- suggestion completion and dismissal
- commitment-first “Work this next” queue
- scheduled hourly deterministic and daily AI/nudge passes

## Parked until real Deal outcomes exist

- automatic portfolio budget or staff allocation
- automatic Deal parking, loss, or punt decisions
- an autonomous “Master Money Agent”
- client-facing autonomous email or scheduling
- AI-set prices or delivery dates
- token-based project pricing
- artificial minimum timelines
- formulas presented as forecast accuracy

The next AI expansion should follow observed founder work, loss reasons, cycle
time, delivery margin, and suggestion usefulness—not enthusiasm for a larger
agent fleet.

## Data model

- `ai_runs`: agent key, trigger, related Deal/contact/account, model, token and
  cost estimates, and timestamp.
- `suggestions`: related Deal, source agent, title, body, open/done/dismissed
  status, resolver, and timestamp.
- `deals`: fit score/rationale/freshness, denormalized portfolio attractiveness,
  engagement health, action urgency, and cumulative AI spend.
- `deal_calls`: source transcript or notes, proposed discovery analysis, review
  status, reviewer, review time, and count of accepted evidence items.
- `discovery_packages`: only the reviewed evidence accepted as current Deal
  truth; the eight solution fields determine solution clarity. Buying-path
  evidence remains on the Deal for compatibility.

The canonical authority boundary remains in
[`OPERATING-MODEL.md`](OPERATING-MODEL.md); the current queue and qualification
workflow remain in [`SALES-PROCESS.md`](SALES-PROCESS.md).
