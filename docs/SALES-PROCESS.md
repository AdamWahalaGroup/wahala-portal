# Wahala sales process

This is the canonical founder sales playbook for the initial two-to-three-person
team. It is intentionally lightweight until enough real outcomes exist to
calibrate the process.

## Lifecycle

| View | Deal stage | Operating meaning |
|---|---|---|
| Opportunities to review | New | Decide whether a real discovery commitment is justified. |
| Deals in progress | Discovery | Qualify the buying motion and understand the solution. |
| Deals in progress | Proposal out | A concrete commercial offer is in the buyer's hands. |
| Deals in progress | Negotiating | Scope, price, authority, or terms are being resolved. |
| Deals in progress | Contracting (`committed` in current code) | Complete approved paper, payment, and mobilization gates. |
| Closed | Won / Lost | Preserve outcome, reason, and project linkage. |

Stages report where a deal is; they do not force a conversation sequence.

## Recommended next step versus agreed follow-up

The **Recommended next step** is system guidance from stage, Discovery Package,
and buying path. In Discovery it will normally be to close a specific evidence
gap, rough out a proposal, or confirm how the purchase will happen. It is not a
new stage, a gate, or evidence that anyone agreed to act.

The **Agreed follow-up** is the next observable action a named party accepted,
with a due date. A scheduled meeting satisfies this rule without a duplicate
action. When an action is complete, replace it with the next agreement rather
than building a second task list inside the Deal. The agreed follow-up is Deal
motion, not another field in the Discovery Package and not a step between
Discovery and Proposal.

In the Deal UI this appears as the compact **Customer motion** strip beneath the
dominant Recommended next step. It expands only when someone records or edits a
commitment. A missing commitment is a health signal, not a competing workflow
instruction.

Every active Deal has either a scheduled meeting or records:

- one specific action;
- a due date;
- whose court it is in: Wahala, client, or third party; and
- a Wahala Deal owner accountable for following it.

Missing and overdue commitments rise above general portfolio attractiveness in
the Home queue. An automated nudge or AI refresh is not a relationship touch.

## Two independent discovery signals

Do not compress discovery into one score. A Deal can be clear enough to scope
while the customer's buying process remains uncertain, or have an eager buyer
while the solution is still too vague to price responsibly.

### Discovery Package (0–10)

The Discovery Package measures whether Wahala understands enough to create a
responsible scope and price. It does not measure win probability. Customer
terminology and deferred scope matter for delivery quality, but do not prove
that a buying motion exists. At **7/10**, Wahala has enough clarity to rough out
a proposal; DISCOVERY 10/10 means all eight package fields have complete evidence.

For call coaching, present the package as a progressive conversation rather
than unrelated fields:

1. **Business context:** what the customer does and who they serve.
2. **Current reality:** current workflow, pain points, and the customer's own terminology.
3. **Desired outcome & first scope:** success metrics, MVP priorities, and deferred scope.
4. **Delivery timing:** requested delivery timing, dependencies, and constraints.

Capture customer terminology throughout the conversation rather than
interrogating it as a standalone vocabulary exercise. Delivery timing is not
the customer's decision process; that belongs in the buying path.

For manual package entry, typing evidence and saving without choosing a status
means **OK**. Choose Partial or Missing only when that is the deliberate
classification. Partial and Missing remain in Ask on the next call; OK removes
the prompt and increases the DISCOVERY x/10 score.

### Buying path (Unverified / Developing / Confirmed)

The Buying path asks whether the customer can credibly make the purchase. It is
Confirmed only when evidence exists for all five signals:

- an internal champion who will help the purchase move;
- the economic buyer who can authorize the commercial decision;
- a compelling event and consequence of doing nothing;
- the evaluation, approval, legal, procurement, and signature process; and
- an identified funding path with concrete evidence.

Unverified means none of these signals is established. Developing means some
are established but at least one material gap remains. Funding maturity uses
one authoritative scale: Unknown maps to Missing, Possible funding source maps
to Partial, and Funding path identified or Budget confirmed maps to OK. Unknown
is an acceptable answer; unsupported certainty is not.

Champion, economic buyer, compelling event, and decision process use the same
OK, Partial, or Missing classification as the Discovery Package. Funding path
derives that classification from its maturity dropdown so two competing status
controls cannot disagree. Every non-Unknown selection requires evidence.
Partial and Missing keep the overall path in Developing; they do not add a
second “Ask on the next call” list. The card instead explains what Unverified,
Developing, and Confirmed mean.

Do not lead a first conversation with budget. Understand the pain and desired
value first, then make the funding and authority questions relevant. The UI
stores these facts separately, but an experienced seller can gather them in the
same natural conversation.

Record discovery evidence once, as a call transcript or meeting notes. AI may
then propose five kinds of updates in a single pending review:

- a long-form discovery memo;
- evidence for the eight Discovery Package fields;
- Buying path evidence such as champion, economic buyer, compelling event,
  decision process, and funding path; and
- commercial classifications such as engagement, delivery, IP, data
  sensitivity, and support; and
- an agreed follow-up only when the source explicitly states the responsible
  party, accepted action, and exact calendar date.

A staff member applies or dismisses the analysis. Applying is item-level:
accepted facts update the Deal and recompute its signals; rejected or unchecked
items do nothing. Existing human-entered evidence is not selected for overwrite
by default. Commercial classifications and agreed follow-ups are never selected by default. In
particular, AI must not infer favorable IP ownership, a funded budget, buyer
authority, low data sensitivity, acceptance of an action, or a calendar date.

## Proposal and contracting

- The Deal groups the Discovery Package and Buying path under **Proposal
  readiness**. It shows two evidence milestones instead of one weighted score:
  Draft ready at DISCOVERY 7/10, and Send ready only when Draft is ready and the
  Buying path is Confirmed. Neither indicator is a win forecast or hard gate.
- Rough out or AI-draft a proposal once DISCOVERY is at least 7/10.
- Before sending, confirm the buying path. If either signal is weak, the portal
  warns and records an override but never creates a hard sales-stage gate.
- Use one recommended proposal path when it is clearly best.
- Use multiple options only when they represent a real customer tradeoff.
- Use paid discovery when uncertainty is too high for responsible fixed pricing.
- AI may draft; a human sets price and approves client-facing claims.
- The proposal drafting agent receives the complete structured Discovery Package
  and Buying path snapshot, including missing and partial classifications. It uses
  Discovery evidence to ground client-facing language and treats Buying path as
  private internal context, surfacing only client-suitable facts that materially
  affect scope, timing, or assumptions.
- Public proposal approval means intent to proceed, not booked revenue.
- Binding execution belongs in a counsel-approved e-signature flow.
- Do not start delivery until the applicable agreement and payment gates pass.

## Initial management metrics

With little historical data, prioritize process visibility over rankings:

- first-response time;
- active deals with a dated agreed follow-up or scheduled meeting;
- overdue Wahala/client commitments;
- meeting reschedules and no-shows;
- Discovery Package and buying-path coverage;
- pending discovery analyses and accepted evidence rate;
- founder hours spent to reach each gate;
- proposals sent and decisions received;
- structured pass, park, and loss reasons; and
- AI cost and accepted suggestion rate.

After enough closed cohorts, add stage conversion, sales cycle, forecast
accuracy, gross margin, source effectiveness, repeat revenue, and seller
coaching views. Always show time range and sample size.
