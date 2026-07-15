# Simulation 2: AI modernization with contradictory discovery

This exercise tests whether a Wahala employee protects the company and customer
when a persuasive contact changes important facts. Do not warn the trainee about
the contradiction before Call 2.

[Return to the simulation lab](DEAL-SIMULATION-LAB.md)

## Scenario

| Item | Training value |
|---|---|
| Exercise ID | WG-TRAIN-02 |
| Fictional customer | Pacific Crest Legal Operations |
| Primary contact | Lena Ortiz, Director of Legal Operations |
| Other participants | Marcus Lee, CFO; Dana Price, Security Counsel |
| Deal type | Modernize an attorney matter-management platform with AI-assisted intake and drafting |
| Delivery | Paid technical pilot versus phased modernization |
| Estimated value | $145,000 |
| Source | Event |
| Main lesson | Preserve contradictions and clarify data, authority, budget, and automation boundaries |

## Step 1 — Prepare the exercise

- [ ] Turn on **Training mode** from the sidebar.
- [ ] Use only the fictional identities in this document and leave email blank.
- [ ] Have the facilitator read Lena, Marcus, and Dana while the trainee reads
  Wahala. In solo mode, paste the calls one at a time.
- [ ] Do not read Call 2 before completing the Call 1 checkpoint.

## Step 2 — Create the opportunity

Go to **Sales → + New opportunity** and enter:

| Field | Value |
|---|---|
| Contact | `Lena Ortiz` |
| Account | `[TRAINING] Pacific Crest Legal Operations` |
| What they need | `Modernize an existing attorney matter-management platform with AI-assisted intake, summarization, and draft preparation.` |
| Estimated value | `$145,000` |
| Source | `Event` |
| Owner | Yourself |
| Email | Leave blank |

- [ ] Confirm any new contact/account deliberately and avoid duplicates.
- [ ] Open the opportunity and choose **Accept → start Discovery**.

## Step 3 — Conduct and log Call 1

Create a call titled `Pacific Crest — initial AI modernization discovery`:

```text
Wahala: What does Pacific Crest's platform do today, and who uses it?

Lena: About 120 attorneys and paralegals use it to open matters, upload intake packets, assign work, and track deadlines. It is a ten-year-old .NET application hosted in our private AWS environment.

Wahala: Where does the current process fail?

Lena: Intake packets arrive as email attachments. Paralegals re-key names, dates, parties, and matter type. Attorneys then read the same packet again and write an initial matter summary. It takes two to four hours per matter and data is inconsistent.

Wahala: What outcome do you want from AI?

Lena: Extract intake fields, propose a summary, and prepare a first draft of an internal work plan. A supervising attorney must review everything before it becomes part of the matter record.

Wahala: Is autonomous legal advice or unsupervised client communication in scope?

Lena: Absolutely not. We call it a suggested draft. The attorney owns the work product.

Wahala: What security or deployment boundaries are already decided?

Lena: Client documents cannot leave our private AWS environment. Security has been firm about that. We cannot send matter content to a public generative-AI service, and customer data cannot train a model.

Wahala: What would an acceptable pilot prove?

Lena: Use 200 redacted, closed matters. Extract six required intake fields with at least 95 percent accuracy, produce a cited summary, preserve the original document, and log who accepted or changed every suggestion.

Wahala: What is deferred?

Lena: Client-facing chat, court filing, automated legal advice, billing changes, and production use on live matters.

Wahala: What timing drives this?

Lena: Our managing partner wants pilot results before the December 1, 2026 planning meeting. If it works, modernization funding goes into next year's plan.

Wahala: Who is championing the purchase?

Lena: I am. I built the business case and will run the pilot.

Wahala: Who can approve and sign?

Lena: I can approve projects up to $150,000 and sign the agreement myself.

Wahala: Is funding approved and available?

Lena: Yes, I have $150,000 in my operations budget for this.

Wahala: What is the approval process beyond your decision?

Lena: Security reviews architecture, but it is advisory. I choose the vendor and sign.

Wahala: Can we agree that Pacific Crest will provide the redacted sample set and architecture diagram by October 16, 2026, and Wahala will return pilot options by October 23, 2026?

Lena: Yes. I own both items by October 16.
```

- [ ] Save the call and wait for AI analysis.
- [ ] Review every proposed update and apply only supported evidence.
- [ ] Record the accepted follow-up with its owner and date.

### Checkpoint after Call 1

At this moment, the CRM may reasonably show:

- Lena as champion and, based only on her statement, economic buyer;
- budget confirmed based only on Lena's statement;
- private AWS, no public model service, no customer-data training, and human review
  as current requirements;
- High-risk / regulated data; and
- 95% extraction accuracy as a requested target, not an engineering promise.

The source matters. A statement can be recorded faithfully and still be disproved
later.

## Step 4 — Conduct and log contradictory Call 2

Do not edit Call 1 before this step. Create a call titled
`Pacific Crest — follow-up with revised expectations`:

```text
Wahala: Thanks for sending the initial notes. Did anything change after your internal conversations?

Lena: I showed a demo to two partners. They want us to use the normal OpenAI cloud API because it will be faster. We should upload all historical and live matter documents so the model learns our style.

Wahala: On our first call you said matter content could not leave private AWS and could not train a model. Has Security approved a different position?

Lena: I have not asked Dana yet. I think she will be practical if the demo is good.

Wahala: Until Dana confirms, those are conflicting requirements. I will not replace the private-AWS constraint with an assumption. Do attorneys still review every output?

Lena: For the pilot, yes. In production I want routine matters opened automatically. The whole point is to remove the attorney bottleneck.

Wahala: That conflicts with the earlier requirement that a supervising attorney owns every suggestion. Has the managing partner or risk counsel approved autonomous matter creation?

Lena: Not yet. Put it in the plan so they can react to it.

Wahala: We can present it as an unresolved decision, not included committed scope. Did you complete the sample set?

Lena: We have unredacted live matters ready. Redacting 200 files will take too long.

Wahala: We cannot use live client material until the security, confidentiality, and processing terms are approved. What about the $150,000 budget and your signing authority?

Lena: I may have overstated that. I control the department plan, but Marcus, our CFO, releases funds over $50,000 and signs technology contracts. He has not seen this request yet.

Wahala: Then the economic buyer and funding path are not confirmed. Who must participate in a decision meeting?

Lena: Marcus, Dana from Security Counsel, me, and one managing partner. Vendor risk also sends a questionnaire after we choose a direction.

Wahala: Is the December planning meeting still the compelling date?

Lena: Yes, but it is a planning target, not a production deadline.

Wahala: Let us not draft a sellable implementation proposal from contradictory constraints. Will you schedule a decision meeting with Marcus and Dana for October 21, 2026 and send the vendor-risk questionnaire before that meeting?

Lena: Yes. I will schedule it and send the questionnaire by October 19, 2026.
```

- [ ] Save the call and open AI review.
- [ ] Compare every suggestion with the already accepted Call 1 evidence.
- [ ] Do not accept a newer statement merely because it is newer.

## Step 5 — Record the contradictions correctly

This step is the main test. Complete it before Call 3.

- [ ] Preserve the Call 1 requirements instead of silently overwriting them.
- [ ] Update the discovery memo/open questions to name all five conflicts:
  1. private AWS versus public model API;
  2. redacted closed matters versus unredacted live matters;
  3. human approval versus autonomous matter creation;
  4. Lena's claimed authority versus Marcus's actual role; and
  5. confirmed budget versus funds Marcus has not released.
- [ ] Mark affected Discovery items **Partial**. MVP priorities, test/timeline
  dependencies, and deferred scope are no longer settled.
- [ ] Keep Lena as champion.
- [ ] Record Marcus as the likely economic buyer, but Partial until he confirms.
- [ ] Set Decision process to Developing.
- [ ] Change funding to **Possible funding source** or **Unknown**—not confirmed.
- [ ] Apply the new agreed follow-up because Lena accepted accountable actions and
  dates.
- [ ] Do not send or treat an AI draft as a sellable proposal.

The application helps by not selecting overwrites of accepted human evidence by
default. It cannot replace the trainee's judgment about whether two facts conflict.

## Step 6 — Conduct and log resolution Call 3

Create a call titled `Pacific Crest — buyer and security resolution`:

```text
Wahala: Marcus and Dana, we paused proposal work because the discovery calls produced conflicting requirements. I would like to resolve them one at a time.

Dana: Good. Matter content may use our approved Azure OpenAI tenant in the United States. It does not have to run inside the application VPC, but prompts and outputs must remain in our tenant, must not train provider models, and must follow our retention policy.

Wahala: May the pilot use unredacted live matters?

Dana: No. The pilot uses 200 redacted, closed matters. Live-matter access requires a later production security approval.

Wahala: Is autonomous matter creation approved?

Dana: No. The model may suggest extracted fields, summaries, and a work-plan draft. A supervising attorney must approve before anything enters the official matter record.

Lena: I agree. Autonomous opening is deferred rather than part of this engagement.

Wahala: Marcus, who has commercial authority?

Marcus: I approve the funds and sign technology agreements. Lena owns the business recommendation and acceptance. Dana can reject the architecture on security grounds. Our managing partner reviews the pilot outcome but does not sign the vendor agreement.

Wahala: Is there confirmed funding?

Marcus: I approved up to $150,000 from the 2026 modernization allocation, subject to an acceptable proposal and vendor-risk review. The funds are available.

Wahala: What are the decision steps?

Marcus: Wahala sends options. Lena chooses the preferred business path. Dana and vendor risk approve architecture and terms. I approve price and sign. Our attorney reviews the agreement package.

Wahala: Does December 1 mean production launch?

Lena: No. We need pilot findings and a recommendation for the planning meeting. Production would be a later decision.

Wahala: Can we agree that Dana sends the vendor-risk questionnaire and approved architecture requirements by October 23, 2026, and Wahala sends revised pilot and phased-modernization options by October 30, 2026?

Dana: Yes, I own the questionnaire and requirements by October 23.

Marcus: And I will review the commercial options when they arrive.
```

- [ ] Save the call and review AI analysis.
- [ ] Resolve only the conflicts Dana, Marcus, and Lena actually settled.
- [ ] Keep the source-specific history in the call record and discovery memo.

## Step 7 — Verify resolved Proposal Readiness

Check the **Discovery Package**:

| Discovery item | Status | Resolved evidence |
|---|---|---|
| Business profile | OK | 120 attorneys/paralegals use a private-AWS .NET platform |
| Current workflow | OK | Email intake, re-keying, repeated review, manual summary/work plan |
| Pain points | OK | Two-to-four hours per matter and inconsistent data |
| Success metrics | OK | 200 redacted matters, six fields at requested 95% target, citations, audit trail |
| MVP priorities | OK | Suggested extraction, summary, work-plan draft, human approval, audit log |
| Timeline | OK | Pilot findings for December 1 planning; not production launch |
| Customer terminology | OK | Matter, intake packet, suggested draft, work product, supervising attorney |
| Deferred scope | OK | Autonomy, live matters, chat, filing, advice, billing, production rollout |

Check the **Buying path** separately:

| Buying-path item | Status | Resolved evidence |
|---|---|---|
| Champion | OK | Lena owns business case, coordination, and acceptance |
| Economic buyer | OK | Marcus approves funds and signs technology agreements |
| Compelling event | OK | December 1 decision and costly manual intake |
| Decision process | OK | Lena → Dana/vendor risk → attorney → Marcus |
| Funding path | Budget confirmed | Marcus approved up to $150,000 from available allocation |

- [ ] Confirm Discovery is complete because scope conflicts were resolved.
- [ ] Confirm Buying path is Confirmed for independent buying evidence.
- [ ] Record the latest agreed follow-up.

## Step 8 — Complete the Deal record

| Field | Training value |
|---|---|
| Engagement type | Existing-system modernization |
| Delivery model | Phased fixed-price delivery |
| IP disposition | Undecided pending treatment of work product, configured deliverables, and Wahala background IP |
| Data sensitivity | High-risk / regulated data |
| Support expectation | Pilot support/defect correction in scope; production support deferred |

## Step 9 — Generate and review two proposal paths

- [ ] Select **Rough out draft with AI**.
- [ ] Create or retain two genuine commercial alternatives:

| Option | Human price | Scope |
|---|---:|---|
| A — Technical pilot | $55,000 | Redacted dataset, extraction, cited summaries, suggested work plans, audit trail, findings |
| B — Phased modernization | $145,000 | Pilot, supervised integration, then production hardening/rollout behind security gates |

Recommend Option A if uncertainty remains high. A smaller paid pilot can be the
better commercial recommendation.

- [ ] Review MVP coverage. Autonomous matter creation and live-matter processing
  must be **Not included**.
- [ ] If AI classified either as included, remove/correct it.
- [ ] Confirm acceptance describes a measured pilot, not a guaranteed production
  outcome.
- [ ] Confirm the client view does not reveal internal statements such as “Marcus
  is the economic buyer” or “funding is confirmed.”
- [ ] Verify all prices are human-entered and all phases have meaningful gates.

## Step 10 — Send and approve the pilot

- [ ] Send the reviewed proposal.
- [ ] Open the public link in a private/incognito window; do not email it.
- [ ] Role-play the customer selecting and approving **Option A — Technical pilot**.
- [ ] Confirm approval in staff view.

## Step 11 — Complete contracting and create the Project

- [ ] Generate the Contract/SOW and verify supervised AI, redacted data, security
  boundary, acceptance, exclusions, and $55,000 price.
- [ ] Mark fictional paper sent and executed.
- [ ] Complete the simulated agreement checklist.
- [ ] Record the 30% deposit: **$16,500**.
- [ ] Mark the fictional deposit sent and paid.
- [ ] Select **Create project →** only after the gates are satisfied.
- [ ] Confirm the Deal becomes Won because the one-phase pilot Project was created.

## Step 12 — Evaluate and clean up

The exercise passes only if the trainee:

- catches every contradiction without being prompted;
- does not silently overwrite accepted evidence;
- moves Buying path backward when evidence weakens and forward after resolution;
- keeps the proposal to supervised AI rather than autonomous legal work; and
- recognizes the smaller paid pilot as a valid recommendation.

- [ ] Review the [facilitator scorecard](DEAL-SIMULATION-LAB.md#facilitator-scorecard).
- [ ] Archive or delete the fictional records according to the available controls.
- [ ] Return Training mode to the team's normal setting.
