# Sales ↔ Delivery Synthesis

*Source material: `SalesDevCycle.pdf` (Jason's 8-phase pipeline write-up) and `transcript.txt`
(the recorded working session over it). This doc distills the disconnects, the synergies, a
shared glossary, and the long-term shape of the Wahala portal. It's meant to be read by both
of us and argued with.*

## Headline

The disagreement in that session was about **model shape and vocabulary, not vision**. Adam
thinks in state machines and invariants; Jason thinks in dispositions and probabilities. Both
are right — about different layers. And the portal already implements the *back half* of
Jason's pipeline: "signed contract automatically creates a project" is literally where the app
starts today. What the PDF describes is the missing front half.

## The two mental models

| | Adam | Jason |
|---|---|---|
| The pipeline is | A graph with loops; discovery / requirements / design are sub-states that "jump around back and forth" | A linear funnel of anchored but **skippable** stages ("this and this can happen in one phone call") |
| A stage means | A state with defined transitions and invariants ("What happens when they sign? What are they locked into?") | A **disposition** + win-probability anchor (10% at discovery → 20% at business requirements → 90% at solution design; probability **resets** at proposal) |
| Structure is judged by | What it costs to build and whether it's conceptually sound ("It's too much") | The decision it enables ("Why does Jason have 20 deals stuck in solution design?") |

**Resolution to encode in the product:** sales *stages* are dispositions — free to skip, free
to move, never enforced. Only *gates* are enforced (a lead must exist first; no payment until
contract; no engineering before contract). **The portal enforces gates and reports on stages.**

## Disconnects, and how each resolves

1. **Funnel vs. graph.** Resolved above. The conversation with a customer is a graph; the
   *reporting* is a funnel. Stages exist for forecasting and Monday-meeting management, not to
   constrain how a call goes.

2. **When is the SOW written?** Adam wants it fleshed out alongside the proposal so engineering
   catches the gory details early (the scar: proposals written by non-engineers → "we said it
   would take two days"). Jason wants it after the option is picked so detail work isn't burned
   during negotiation. **AI dissolves the trade-off:** SOW-level detail is now nearly free to
   *generate* at proposal time (Adam's safety) while only being *shown and signed* at contract
   (Jason's sequencing). From the session: "Did we do that while we were doing the statement of
   work? We could have, that's fine… are we throwing some away? Maybe."

3. **What signing a proposal means.** Proposal = good-faith agreement to proceed —
   deliberately **no deposit** (undercutting dev shops that take 5%). Negotiation is a function
   *within* the proposal stage. Contract is a *phase*, not a document: MSA, NDA, insurance,
   SOW, payment. Signed contract auto-creates the project.

4. **Vocabulary.** See glossary below. "Commercials" was a pure vocabulary gap; "epic" is a
   word sales will never say to a customer (the portal already renders "Focus area").

5. **Where engineering starts.** The PDF's core message: at the lead, not at "requirements."
   Largely already agreed — "I kinda had the basic of this already… more than I realized."

## Synergies

- **Same thesis, both quoted it approvingly:** "Most of this knowledge is lost after the
  meeting." / "Not with our system, it won't be. That's the goal, that's what we're solving."
- **Convergent terminology:** the portal renamed work "Stages" → "Phases" *before this
  conversation*, freeing "stage" for the sales funnel — exactly the split landed on in the
  session (sales = stages, engineering = phases).
- **Jason's complexity gate is the Estimator agent.** "1–5, three-and-under fast-track it,
  3.1+ goes to engineering for hardcore review, what our AI thinks complexity is" — this is
  the S/M/L Estimator already designed for the AI pipeline; it just lives earlier in the
  funnel.
- **Option A / Option B, always.** Clicked instantly via metaphor ("do you want to mow the
  yard this morning or this afternoon?"). Metaphor is the shared language — shopping cart /
  checkout, dating, the airport-bar lead.
- **AI is already the communication bridge.** The PDF was AI-written to explain Jason's model;
  the transcript came from our own legal speech-to-text app. We're dogfooding the product loop
  (capture the conversation → transform it into artifacts) on ourselves before any customer.
- **Shared allergy to wasted time.** "If I can do this well, we walk away from fifty percent
  of the opportunities" — and that's a win, not a loss.

## Glossary (proposed — argue here)

| Term | Meaning |
|---|---|
| **Lead** | An *unowned* record: name + number + context (source, industry). Means nothing until someone qualifies it. Can be handed off. |
| **Contact** | A person. Can belong to multiple companies over time (many-to-many). |
| **Company** | The business entity a contact currently represents. |
| **Deal** (opportunity) | One potential engagement, moving through sales stages. |
| **Stage** (sales) | A *disposition* of a deal: lead → discovery → business requirements → solution design → proposal → (negotiation) → contract. Skippable; carries a win-probability anchor; probability resets at proposal. |
| **Phase** (delivery) | A unit of work inside a project: quoted, approved, paid, in progress, delivered, accepted. What the portal calls "Phase" today. |
| **Quote vs. Proposal** | Same artifact, different audience. Shopping cart = quote; checkout = proposal. Big business hears "proposal." Always Option A / Option B. |
| **Commercials** | Umbrella term for the contract-phase document set: SOW, NDA, MSA, insurance. |
| **SOW** | Digital, on the platform. Focus areas + user stories + acceptance criteria. Signed at contract; task lists get built *after* SOW sign-off. |
| **Focus area** | Client-facing word for what engineering calls an epic. Never say "epic" to a customer. |
| **Gate** | A hard invariant the portal enforces (no payment until contract; no engineering before contract). Stages are never gates. |

## Communication playbook

1. **Encode this glossary in the portal** (tooltips, docs) so the software becomes the
   translator. Don't debate terms live — trap them here and translate asynchronously.
2. **Jason: lead with the decision a structure enables.** "It's too much" evaporated the
   moment the 20-stuck-deals example landed. Structure-first triggers the complexity alarm;
   decision-first doesn't.
3. **Adam: label the objection type** — "expensive to build," "conceptually wrong," or
   "premature." Blurred together they read as resistance; most in the session were actually
   "premature."
4. **Keep asking the invariant questions.** "What are they locked into when they sign?"
   produced the crispest answers of the whole session — those answers *are* the gate
   definitions. Standing checklist question for every stage.
5. **Keep recording sessions** and feed transcripts into the portal's client/project memory.
   This document is the proof the loop works.
6. **Flag:** the Reddit alias/persona marketing play carries real platform-ban and reputation
   risk. Founder posts with disclosure ("I built this") perform comparably on Reddit without
   the downside. Worth a second look before executing.

## What the portal becomes

Today the portal starts at "create project" — Phase 5 of the PDF. The long-term shape is the
full pipeline, front half built in independently shippable releases, back half already live:

- **R1 — CRM entities.** Leads (unowned; qualification action; handoff), contacts ↔ companies
  (many-to-many), deals with skippable sales stages + per-stage probability anchors, and a
  funnel dashboard: deals per stage per person, stuck-deal detection for Monday meetings.
- **R2 — Discovery capture.** Per-deal artifacts (business profile, current workflow, goals,
  pain points, success metrics, decision makers, customer terminology), recording/transcript
  upload → AI extraction into a structured Discovery Package. Reuses the AI draft provider and
  client-memory (`aiContextMd`) already built.
- **R3 — Proposal engine.** Always Option A / Option B, generated from the Discovery Package;
  AI complexity score 1–5 gates fast-track vs. engineering review; proposal versioning
  (Proposal 2 after the option is picked); e-sign; explicitly no deposit.
- **R4 — Contract room.** Digital MSA / NDA / insurance / SOW, where the SOW is focus areas +
  user stories + acceptance criteria — exactly what the AI draft flow already emits. Client
  sign-off, payment, and **signed contract auto-creates the project**: the seam into
  everything live today.
- **R5 — Handoff / B-team layer.** Post-SOW task generation and assignment to delivery
  engineers, so the two of us run lead → contract at 10–20 deals a quarter and hand
  engineering off.
- **Parallel platform plays.** Pre-provisioned cheap POC infrastructure ("$5–10/month, ready
  to go") for fast proofs of concept; side apps (legal speech-to-text) as both revenue and
  dogfood feeding R2.

The three-agent AI pipeline sketched earlier (Requirements → Estimator → Proposal) folds
directly into R2/R3 — it stops being a project-creation feature and becomes the engine of the
sales pipeline itself.
