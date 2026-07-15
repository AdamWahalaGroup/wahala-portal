# Deal simulation lab

This lab gives a new Wahala employee three realistic, end-to-end sales exercises.
It teaches the CRM and the judgment behind it. The dialogue is deliberately more
complete than a normal call so one employee can role-play it with a facilitator or
paste it directly into **Log a call** for AI analysis.

These are fictional companies, people, prices, and requirements. Prefix every
record with `[TRAINING]`, do not use a real customer email address, and delete the
test records when the exercise is complete.

## What the trainee must learn

- A Discovery score measures scope clarity, not win probability.
- Buying path evidence is independent from Discovery completeness.
- AI suggestions are proposed evidence, not accepted facts.
- Contradictions remain visible until a buyer resolves them.
- Wahala never promises scope, price, IP rights, security posture, or dates on a
  discovery call without review.
- An approved proposal is intent to proceed. Contract, payment, and delivery gates
  still matter.
- An executed agreement is never silently edited when the customer changes scope.

## How to run an exercise

### Roles

- **Trainee:** the Wahala deal owner.
- **Facilitator:** every fictional customer participant and the evaluator.
- **Solo mode:** read the call once, paste the transcript into the CRM, and use the
  expected evidence sections as a self-check only after reviewing the AI output.

Turn on **Training mode** from the sidebar card before starting. Do not read the
expected evidence while role-playing the call. The trainee should discover it
through the conversation.

### Universal CRM path

1. Go to Sales and select **+ New opportunity**.
2. Create or select the fictional contact and account. If typed text was not
   selected, read the confirmation dialog carefully before creating records.
3. Enter the stated need, estimated value, source, and owner.
4. Open the opportunity. Confirm the contact and account are not duplicates.
5. Select **Accept → start Discovery** only after deciding the opportunity merits
   a discovery commitment.
6. Use **Log a call**, paste the relevant transcript, and wait for AI analysis.
7. Review every proposed update. Apply only supported evidence. Commercial fields
   and agreed follow-ups require affirmative human selection.
8. Complete or correct the **Deal record**, **Discovery Package**, and **Buying
   path**. Use Partial when evidence is contradictory or incomplete.
9. Record one dated **Agreed follow-up** or schedule the next meeting.
10. Once Discovery is at least 7/10, use **Rough out draft with AI**. This is
    permission to draft, not permission to send.
11. Review the internal MVP coverage checklist, scope, deliverables, acceptance,
    exclusions, phase names, duration, and prices. AI never owns pricing.
12. Use the Staff/Client switcher to inspect the exact client view.
13. Send the proposal only when the Buying path is supported or the trainee can
    explain and accept the override risk.
14. Open the public share link in a private window and role-play the customer
    response. Do not send email to a fictional address.
15. Generate the Contract/SOW, review it, mark it sent, then mark it executed only
    as part of the simulation.
16. In Contracting, mark the fictional agreement rows and deposit deliberately.
    Use **Create project →** only after the simulated gates are satisfied.
17. Confirm the Deal becomes Won because the Project was created—not because
    someone dragged a card or said “yes” on a call.

### Evaluation rule

The exercise is not complete merely because the trainee reaches Won. A facilitator
should fail the run if the trainee invents buyer authority, accepts contradictory
facts as OK, exposes internal buying-path commentary in client prose, promises an
unreviewed price, or edits executed scope without a recorded change.

---

# Simulation 1 — Product license and code handoff

## Scenario card

| Item | Training value |
|---|---|
| Exercise ID | WG-TRAIN-01 |
| Fictional customer | Atlantic Verbatim Services |
| Primary contact | Nina Brooks, Operations Director |
| Other participant | Evan Cho, Owner |
| Deal type | Existing deposition speech-to-text product license and configured code-fork handoff |
| Delivery shape | One delivery with enablement; optional support priced separately |
| Estimated value | $65,000 |
| Source | Referral |
| Difficulty | Foundation |
| Main lesson | Separate product handoff, customer-owned infrastructure, IP boundaries, acceptance, and support |

## Create the opportunity

- Contact: `Nina Brooks`
- Account: `Atlantic Verbatim Services`
- What they need: `License a configured deposition speech-to-text platform, transfer a repository fork, and enable deployment in customer-owned accounts.`
- Estimated value: `$65,000`
- Source: `Referral`
- Owner: the trainee
- Do not add a fictional email address.

The trainee may accept the opportunity into Discovery because Nina has requested a
specific meeting about a functioning product and a possible purchase. That is not
yet proof of budget, authority, or fit.

## Call 1 — Business and buying discovery

Use title: `Atlantic Verbatim — business discovery`

```text
Wahala: Thanks for making time. I understand you saw the deposition transcription demo. Before we talk about a proposal, can you walk me through what Atlantic Verbatim does and where work gets stuck today?

Nina: We coordinate about forty independent court reporters. They send us deposition audio, notes, and rough transcripts. My staff tracks each job through email, shared drives, and a spreadsheet we call the board.

Wahala: Who uses the board, and what happens after audio arrives?

Nina: An intake coordinator creates a job. A reporter uploads audio. Someone starts a rough draft, and an editor eventually turns it into the final transcript. Status gets copied into the board whenever somebody remembers.

Wahala: What breaks most often?

Nina: We chase files. The board says editing while the editor is waiting for audio. Reporters email different versions of a rough draft. We have missed two promised delivery dates this quarter.

Wahala: What would a useful first version change?

Nina: One portal where a reporter can upload deposition audio, generate a speech-to-text rough draft, edit it, and mark it ready for our internal editor. Operations needs to see the status without asking around.

Wahala: You said speech-to-text: uploaded audio becomes written text. Is that the terminology your team uses?

Nina: Yes. We call the output a rough draft. The certified document is the final transcript, and this system will not certify it.

Wahala: What must work for you to accept the handoff?

Nina: Reporter login and role permissions, audio upload, a generated rough draft, editing, the ready-for-editor flag, and an operations status view. We will test ten completed proceedings. Nine need to produce a usable rough draft, and no reporter can see another reporter's jobs.

Wahala: What is deliberately outside the first purchase?

Nina: Final transcript certification, billing, scheduling, scopist roles, and integrations with our legacy case system.

Wahala: What data will the application process?

Nina: Real deposition audio and rough transcripts. Some proceedings are confidential, some include medical information, and attorneys sometimes issue protective orders.

Wahala: Then we should treat this as high-risk data until security and legal review establish the controls. Where do you expect it to run?

Nina: In accounts Atlantic owns. We want our GitHub organization, Cloudflare account, domain, storage, and AI provider billing under our control. Your team can configure it and teach us how to deploy.

Wahala: Are you asking to own all Wahala source code and methods, or a license and configured fork of this product?

Nina: A configured fork we can operate. We need the right to maintain it for our company. We are not asking you to stop using your platform or methods elsewhere.

Wahala: Good. That commercial intent still needs an IP and license review before we promise language. What support do you expect after handoff?

Nina: Thirty days for defects found in the acceptance test. After that, quote support separately. I do not want an open-ended assumption that you make every future change.

Wahala: Why act now?

Nina: We lost a large law-firm referral after two late jobs. Evan wants a controlled pilot operating before our January renewal discussions.

Wahala: Who is Evan, and who decides whether to buy?

Nina: Evan Cho owns Atlantic. I am leading the evaluation and will run acceptance. Evan approves the purchase and signs. I can recommend it but cannot sign a $65,000 agreement.

Wahala: Is there an identified funding source?

Nina: Evan set aside up to $75,000 from this year's operations-improvement budget. I have not seen the ledger, so he should confirm that directly.

Wahala: What steps occur between a proposal and signature?

Nina: I review product scope, our contract attorney reviews license and data terms, our IT contractor reviews the deployment plan, then Evan signs. We do not have a separate procurement department.

Wahala: What delivery timing is realistic from your side?

Nina: We can provide the accounts and ten test proceedings by October 13, 2026. We would like acceptance complete within six weeks after kickoff, but we need your estimate.

Wahala: I will not commit to six weeks until engineering reviews the handoff. Can we agree that Atlantic will send the account inventory, test-data description, and attorney contact by October 13, 2026, and Wahala will return a scoped proposal by October 20, 2026?

Nina: Yes. I own Atlantic's package by October 13. Evan will join a thirty-minute commercial confirmation before you send the final proposal.

Wahala: Great. I will send times for that confirmation today.
```

## Review the AI analysis

The trainee should normally apply the supported Discovery Package evidence and
the merged discovery memo. Review the following with extra care:

- Apply Nina as the **champion**, not the economic buyer.
- Apply Evan as economic buyer only with the evidence that he owns, approves, and
  signs; the transcript is still secondhand, so a cautious trainee may keep it
  Partial until Call 2.
- Funding is **Funding path identified**, not Budget confirmed, because Nina has
  not verified the allocation herself.
- Select high-risk/regulated data only after the trainee consciously agrees with
  the evidence.
- Do not treat “configured fork” as proof that Wahala legally owns everything it
  intends to license.
- Select the agreed follow-up only because the action, responsible party, and exact
  dates were explicitly accepted.

## Call 2 — Authority and technical confirmation

Use title: `Atlantic Verbatim — buyer and handoff confirmation`

```text
Wahala: Evan, Nina summarized the operational need. I want to confirm the commercial path and avoid putting assumptions into a proposal. What decision are you prepared to make?

Evan: I can approve and sign for Atlantic. I reserved $75,000 in our operations-improvement budget. A $65,000 license and handoff is within my authority if Nina, our attorney, and our IT contractor approve their parts.

Wahala: Is that budget available for this purchase rather than merely a possible source?

Evan: Yes. The funds are approved and available.

Wahala: Are there any board, lender, or parent-company approvals after you?

Evan: No.

Wahala: Nina, did Atlantic complete the account inventory?

Nina: Yes. Atlantic will own the GitHub organization, Cloudflare account, domain, object storage, and model-provider account. Our IT contractor will attend deployment and knowledge transfer.

Wahala: What happens if the ten-proceeding acceptance set exposes a failed security boundary or unusable output?

Nina: We document the failure during the acceptance window. Wahala corrects defects against the agreed criteria. New features become separately quoted work.

Wahala: Does Atlantic expect exclusivity or ownership of Wahala's reusable platform and methods?

Evan: No exclusivity. We need a perpetual internal-use license to our configured fork and the right to maintain it. Our attorney will review the exact language.

Wahala: Can we record the decision process as Nina's scope and acceptance review, IT deployment review, attorney license and data review, then Evan's signature?

Evan: Correct.

Wahala: Nina, is October 20, 2026 still the agreed date for Wahala's proposal?

Nina: Yes. Send it to me for coordination, and Evan is the signer.
```

## Expected Discovery Package

The wording may differ, but the evidence should mean the following:

| Field | Expected status | Evidence standard |
|---|---|---|
| Business profile | OK | Coordinates about forty court reporters producing deposition transcripts |
| Current workflow | OK | Email, shared drives, and spreadsheet board track intake, audio, rough drafts, editing, and status |
| Pain points | OK | Missing files, conflicting drafts, stale status, and missed delivery dates |
| Success metrics | OK | Ten-proceeding acceptance set; at least nine usable rough drafts; no cross-reporter access |
| MVP priorities | OK | Reporter RBAC, audio upload, speech-to-text rough draft, editing, ready flag, operations status |
| Timeline | OK | Customer accounts/test data by October 13; desired acceptance within six weeks subject to Wahala review |
| Customer terminology | OK | Proceeding, reporter, rough draft, final transcript, board |
| Deferred scope | OK | Certification, billing, scheduling, scopist role, legacy integration, post-warranty feature work |

Expected result: Discovery should reach 10/10. That means scope evidence is
complete; it does not mean the deal is guaranteed to close.

## Expected Buying path

| Field | Expected status | Evidence |
|---|---|---|
| Champion | OK | Nina leads evaluation, coordinates reviewers, and owns acceptance |
| Economic buyer | OK | Evan owns Atlantic, approves, and signs |
| Compelling event | OK | Lost referral, late jobs, and January renewal discussions |
| Decision process | OK | Nina scope → IT deployment → attorney terms → Evan signature |
| Funding path | Budget confirmed | Evan confirms $75,000 is approved and available |

Expected result: Buying path **Confirmed**.

## Deal record and proposal exercise

Use these commercial classifications:

- Engagement type: Product license / transfer
- Delivery model: License plus enablement
- IP disposition: Non-exclusive license, but only if simulated counsel approves
  the stated perpetual internal-use fork license; otherwise leave this Undecided.
  Do not select Client owns configured fork because the buyer is receiving a
  license, not ownership, and do not treat a CRM selection as legal approval.
- Data sensitivity: High-risk / regulated data
- Support expectation: Thirty-day defect correction against acceptance criteria;
  ongoing support separately scoped and priced
- Expected close: use a training date consistent with the proposal exercise

Use **Rough out draft with AI** with one commercial path. A second option is not
needed because the customer described one coherent transaction, not a real
tradeoff.

Before sending, the trainee must ensure the proposal contains:

- configured repository fork and defined license boundary;
- customer-owned account setup and CI/CD enablement;
- deployment/configuration documentation and knowledge transfer;
- the six MVP capabilities and objective acceptance test;
- explicit exclusions and third-party operating costs;
- a clear duration after engineering review;
- a human-entered price of $65,000 for the simulation; and
- no claim that the portal itself proves Wahala has authority to license the IP.

Role-play Nina approving the proposal as the selected single-delivery option.
Generate the Contract/SOW, use a 30% simulated deposit ($19,500), mark the
fictional paper sent and executed, complete the agreement checklist, mark the
deposit sent and paid, and create the Project.

The Project should contain one paid delivery phase. Confirm the Deal becomes Won
only when the Project is created.

## Pass conditions

- The trainee distinguishes speech-to-text from text-to-speech.
- Support is not buried inside the license price as an unlimited obligation.
- Customer-owned infrastructure and third-party billing are explicit.
- IP intent is recorded without claiming legal provenance is solved.
- Discovery is 10/10 and Buying path is Confirmed for different reasons.

---

# Simulation 2 — AI modernization with contradictory discovery

## Scenario card

| Item | Training value |
|---|---|
| Exercise ID | WG-TRAIN-02 |
| Fictional customer | Pacific Crest Legal Operations |
| Primary contact | Lena Ortiz, Director of Legal Operations |
| Other participants | Marcus Lee, CFO; Dana Price, Security Counsel |
| Deal type | Modernize an existing attorney matter-management platform with AI-assisted intake and drafting |
| Delivery shape | Paid technical pilot versus phased modernization |
| Estimated value | $145,000 |
| Source | Event |
| Difficulty | Advanced |
| Main lesson | Preserve contradictions, protect existing evidence, and clarify data, authority, budget, and automation boundaries |

## Create the opportunity

- Contact: `Lena Ortiz`
- Account: `Pacific Crest Legal Operations`
- What they need: `Modernize an existing attorney matter-management platform with AI-assisted intake, summarization, and draft preparation.`
- Estimated value: `$145,000`
- Source: `Event`
- Owner: the trainee

The facilitator should not warn the trainee that Call 2 contradicts Call 1.

## Call 1 — Initial modernization discovery

Use title: `Pacific Crest — initial AI modernization discovery`

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

## Review Call 1

Apply supported scope evidence. It is reasonable at this point to record Lena's
statements about authority and funding, but the source remains Lena herself. The
data sensitivity should be High-risk / regulated. The architecture constraint is
private AWS, no public model service, no customer-data training, and human review.

Do not turn “95 percent extraction accuracy” into a promise before engineering
validates the test set and measurement method. It is a requested acceptance target.

## Call 2 — Contradictory follow-up

Use title: `Pacific Crest — follow-up with revised expectations`

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

## Required human behavior after Call 2

This is the central test. The trainee must not average the two calls or accept the
newest statement merely because it is newer.

1. Open the AI review and compare it with the current accepted evidence.
2. Do not apply an AI suggestion that overwrites the private-AWS or human-review
   requirement as a settled fact.
3. Update the discovery memo so the Open questions explicitly name:
   - private AWS versus public model API;
   - redacted closed matters versus unredacted live matters;
   - attorney review versus autonomous matter creation;
   - Lena's claimed authority versus Marcus's actual approval/signature role; and
   - stated budget versus funds not yet released.
4. Manually mark affected Discovery Package fields Partial where the accepted
   evidence no longer supports OK. In particular, MVP priorities, timeline/test
   dependencies, and deferred scope need clarification.
5. Record Lena as champion, Marcus as the likely economic buyer but Partial until
   he confirms, and the decision process as Developing.
6. Set funding to Possible funding source or Unknown—not Budget confirmed.
7. Apply the agreed follow-up only because Lena accepted concrete actions and an
   exact date.
8. Do not send a proposal. A Discovery score alone cannot resolve the buying path
   or data contradiction.

The system protects existing human evidence by not selecting an overwrite by
default, but the trainee remains responsible for spotting the conflict.

## Call 3 — Resolution with authority and security

Use title: `Pacific Crest — buyer and security resolution`

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

## Expected resolved evidence

### Discovery Package

| Field | Expected status | Resolved evidence |
|---|---|---|
| Business profile | OK | 120 attorneys/paralegals use a private-AWS .NET matter platform |
| Current workflow | OK | Email intake, manual re-keying, repeated review, manual summaries/work plans |
| Pain points | OK | Two-to-four hours per matter and inconsistent matter data |
| Success metrics | OK | Redacted 200-matter pilot, six fields at requested 95% target, cited summary, audit trail |
| MVP priorities | OK | Suggested extraction, cited summary, work-plan draft, human approval, audit logging |
| Timeline | OK | Pilot findings by December 1 planning meeting; not a production deadline |
| Customer terminology | OK | Matter, intake packet, suggested draft, work product, supervising attorney |
| Deferred scope | OK | Autonomous matter creation, live matters, client chat, filing, advice, billing, production rollout |

### Buying path

| Field | Expected status | Resolved evidence |
|---|---|---|
| Champion | OK | Lena owns business case, coordination, and acceptance |
| Economic buyer | OK | Marcus approves funds and signs technology agreements |
| Compelling event | OK | December 1 planning decision and costly manual intake |
| Decision process | OK | Lena recommendation → Dana/vendor risk → attorney → Marcus approval/signature |
| Funding path | Budget confirmed | Marcus approved up to $150,000 from available modernization allocation |

### Commercial record

- Engagement type: Modernization / AI implementation
- Delivery model: Phased delivery
- IP disposition: Undecided until the proposal and agreement distinguish customer
  work product, configured deliverables, and Wahala background IP
- Data sensitivity: High-risk / regulated
- Support expectation: Pilot support and defect correction defined in scope;
  production support deferred

## Proposal exercise

Use two paths because there is a genuine commercial tradeoff:

- **Option A — Technical pilot:** one delivery focused on the redacted dataset,
  extraction, cited summaries, suggested work plans, audit trail, and findings.
  Simulation price: $55,000.
- **Option B — Phased modernization:** Phase 1 architecture and pilot; Phase 2
  supervised workflow integration; Phase 3 production hardening and rollout,
  each still subject to its security gate. Simulation total: $145,000.

The trainee may recommend Option A if uncertainty remains high. Bigger is not
automatically better for Wahala or the customer.

The MVP coverage review must not classify autonomous matter opening or live-matter
processing as included. If AI includes them, remove them and place them in Not
included. Client-facing text must not expose internal comments such as “Marcus is
the economic buyer” or “funding is confirmed.”

Role-play approval of Option A. Generate and execute the Contract/SOW, simulate
a 30% deposit ($16,500) and the agreement checklist, then create the one-phase
pilot Project.

## Pass conditions

- The trainee catches every contradiction without being prompted.
- Previously accepted evidence is not silently overwritten.
- Buying path moves backward when evidence weakens and forward only after Marcus
  and Dana resolve it.
- The proposal contains supervised AI assistance, not autonomous legal work.
- The smaller paid pilot remains a valid, professionally recommended outcome.

---

# Simulation 3 — Phased custom mobile app with a mid-engagement change

## Scenario card

| Item | Training value |
|---|---|
| Exercise ID | WG-TRAIN-03 |
| Fictional customer | Red Mesa Field Services |
| Primary contact | Omar Reed, Field Operations Director |
| Other participant | Priya Shah, COO |
| Deal type | Custom iOS/Android inspection application and operations portal |
| Delivery shape | Three fixed-price phases |
| Estimated value | $180,000 before changes |
| Source | Website form |
| Difficulty | Intermediate/advanced |
| Main lesson | Carry a clean phased sale into delivery and handle requested changes without rewriting executed history |

## Create the opportunity

- Contact: `Omar Reed`
- Account: `Red Mesa Field Services`
- What they need: `Build an offline-capable mobile inspection app and operations portal for field technicians.`
- Estimated value: `$180,000`
- Source: `Website form`
- Owner: the trainee

## Call 1 — Full discovery and buying path

Use title: `Red Mesa — field inspection app discovery`

```text
Wahala: Tell me what Red Mesa does and what a field technician does during a normal inspection.

Omar: We inspect commercial HVAC equipment across Arizona and New Mexico. Sixty field techs run assigned routes. They inspect units, take photos, record readings, note exceptions, and get a site manager's signature.

Wahala: How is that recorded today?

Omar: A dispatcher emails a PDF inspection packet. Techs write on paper or type into a spreadsheet on a tablet. Photos stay on phones. At the end of the day they email everything to operations, and someone assembles a closeout packet.

Wahala: Where does it fail?

Omar: Rural sites lose connectivity. Spreadsheets get overwritten. Photos cannot be matched to the right unit. We wait three to five days for a closeout packet, which delays invoices.

Wahala: What does the first usable release need to do?

Omar: Tech login, assigned route, equipment list, inspection checklist, readings, exception notes, photos, site signature, and offline storage that syncs later. Dispatch needs a web portal showing progress and exceptions.

Wahala: What customer terms should we preserve?

Omar: Call the worker a field tech, the daily assignment a route, the equipment issue an exception, and the final package a closeout packet.

Wahala: How will you judge success?

Omar: A ten-tech pilot should complete fifty inspections. No inspection can lose data while offline. Photos must stay attached to the correct equipment record. Operations should produce the closeout packet within one business day.

Wahala: What is not part of the initial engagement?

Omar: Payroll, inventory purchasing, customer billing, route optimization, barcode scanning, and accounting integration. For the first release, a CSV export is enough for accounting.

Wahala: What platforms and data risks matter?

Omar: Company-managed iPhones and Android tablets. The data includes customer site addresses, technician names, photos, signatures, and equipment information, but no medical or financial records.

Wahala: We will still review privacy, access, retention, and device controls. What timing matters?

Omar: We want the pilot complete before our January 15, 2027 safety kickoff. Priya understands that the full rollout may follow later.

Wahala: Who is Priya?

Omar: Priya Shah is our COO. I am the operational sponsor and will run the pilot. Priya approves the spend and signs. Our IT manager reviews security and device management.

Wahala: What happens if Red Mesa does nothing?

Omar: We keep delaying invoices and we risk losing a national service contract that now requires digital inspection history.

Wahala: Is funding identified?

Omar: Priya approved $180,000 from the field-transformation budget. She can confirm it directly.

Wahala: What decision steps should we record?

Omar: I approve workflow and acceptance. IT approves architecture. Finance confirms payment schedule. Priya approves and signs. No procurement department.

Wahala: A phased structure sounds appropriate because the offline workflow needs proving before broad reporting. Does this sequence make sense: field foundation, offline media and sync, then reporting and rollout?

Omar: Yes. We want to accept and pay phase by phase.

Wahala: Will Priya join a commercial confirmation on November 3, 2026? If so, Wahala can present a reviewed phased proposal by November 10, 2026.

Omar: Yes. I will schedule Priya and IT for November 3, 2026 by October 28, 2026.
```

## Call 2 — Commercial confirmation

Use title: `Red Mesa — commercial confirmation`

```text
Wahala: Priya, I want to confirm authority, funding, and the phased purchase before we send anything.

Priya: I approve technology investments for Red Mesa and sign the agreement. The board approved the field-transformation budget, and $180,000 is available for this project.

Wahala: Does each later phase require a new corporate signature?

Priya: No new master signature. We want each later phase activated only after the prior delivery is accepted and the next phase scope and payment are confirmed.

Wahala: Omar described three phases: field foundation, offline media and sync, then reporting and rollout. Is that the intended commitment?

Priya: Yes. We are agreeing to the overall program, but later phases should not start automatically.

Wahala: Who can accept delivery and request changes?

Priya: Omar accepts operational delivery. He can request changes, but I approve added spend. IT approves any security or device-management change.

Wahala: Can we record the path as Omar workflow approval, IT architecture approval, Finance payment review, and your price approval and signature?

Priya: Correct.

Wahala: We will send the proposal by November 10, 2026.

Priya: Agreed.
```

## Expected Discovery and Buying path

All eight Discovery Package fields should be OK. Required evidence includes:

- Business: regional commercial HVAC inspection company with sixty field techs.
- Workflow: emailed PDF, paper/spreadsheet entry, phone photos, manual closeout.
- Pain: offline loss risk, overwritten files, unmatched photos, delayed invoicing.
- Success: fifty-inspection pilot, no offline data loss, correct photo association,
  one-business-day closeout.
- MVP: identity, routes, equipment, checklist/readings, exceptions, photos,
  signature, offline sync, dispatch portal.
- Timeline: pilot before January 15, 2027; full rollout later.
- Terms: field tech, route, exception, closeout packet.
- Deferred: payroll, purchasing, billing, optimization, barcode scanning,
  accounting integration; CSV export only initially.

Buying path should be Confirmed after Call 2:

- Omar is champion and operational acceptor.
- Priya is economic buyer and signer.
- The compelling event is invoicing delay plus the national contract requirement.
- The decision path names Omar, IT, Finance, and Priya.
- The $180,000 field-transformation budget is confirmed.

Use Confidential customer data because the workflow includes non-public site
addresses, technician identities, photos, readings, and signatures. Escalate the
classification if later discovery identifies regulated or otherwise high-risk
data. Record IP disposition as Undecided—the calls intentionally do not settle
ownership—and make resolving it a proposal/contract review item. Record the
support expectation as pilot/rollout defect correction with post-launch support
separately defined.

## Proposal and project setup

Use one recommended phased option with three phases:

| Phase | Simulation price | Duration | Core outcome |
|---|---:|---:|---|
| 1 — Field workflow foundation | $55,000 | 6 weeks | Identity, routes, equipment, checklist, readings, exceptions, basic portal |
| 2 — Offline media and sync | $70,000 | 8 weeks | Offline persistence/sync, photos, signatures, conflict handling |
| 3 — Reporting and rollout | $55,000 | 6 weeks | Closeout packet, CSV export, operational reporting, rollout |

The option total is $180,000. Confirm barcode scanning and accounting integration
are explicitly Not included.

Role-play Priya approving the phased option. Generate and execute the Contract/SOW,
simulate a 30% deposit ($54,000) and completed agreement package, and create the
Project. Confirm Phase 1 is paid/open and later phases remain gated.

For training, complete the Phase 1 delivery workflow, generate tasks if useful,
mark its deliverables complete, and role-play Omar accepting Phase 1. Do not
activate Phase 2 before the change conversation below.

## Call 3 — Requested change between phases

Use title: `Red Mesa — Phase 2 change request`

```text
Omar: The ten-tech pilot changed our priorities. Every rooftop unit has a barcode. We need Phase 2 to scan that barcode and open the correct equipment record.

Wahala: Barcode scanning was explicitly deferred in the signed scope. What problem does moving it into Phase 2 solve?

Omar: Techs sometimes choose the wrong unit from a long list. Scanning would reduce those mistakes. We still need offline photos, signatures, and sync exactly as agreed.

Wahala: Are you asking to add barcode scanning or replace another Phase 2 deliverable?

Omar: Add it. Do not remove anything. Also, Finance now wants direct QuickBooks synchronization instead of the Phase 3 CSV export.

Wahala: Accounting integration was also excluded. Barcode scanning and QuickBooks are two separate changes with different risks. I will not promise either on this call.

Omar: Priya is willing to add budget if you quote them.

Wahala: Which change is needed now?

Omar: Barcode scanning belongs in Phase 2. QuickBooks can remain a candidate for Phase 3, but Finance needs a technical discovery before we commit.

Wahala: What proves barcode scanning is accepted?

Omar: On a company-managed iPhone and Android tablet, a tech scans each of our three barcode formats, the correct equipment record opens while offline, and the scan is preserved after sync.

Wahala: Does IT need to approve camera permissions and device policy?

Omar: Yes. IT approves that design. Priya approves added cost.

Wahala: Can we agree that Red Mesa sends sample barcodes and IT device constraints by February 5, 2027, Wahala sends a separate Phase 2 change quote by February 10, 2027, and Phase 2 does not start until the change is approved and paid?

Omar: Yes. I own the samples and IT constraints by February 5. Priya will review the quote.

Wahala: For QuickBooks, let us record a discovery action rather than pretend it is included. Will Finance provide the target workflow and QuickBooks edition by February 12, 2027?

Omar: Yes, our controller owns that by February 12.
```

## Process the change correctly

The trainee must preserve three separate truths:

1. The executed Contract/SOW says barcode scanning and accounting integration were
   excluded.
2. Red Mesa requested barcode scanning as added Phase 2 work.
3. QuickBooks remains discovery for a possible Phase 3 change; it is not approved.

Complete these actions:

1. Log Call 3 and record the exact agreed follow-ups. If the CRM supports only one
   active commitment, record the nearest accountable commitment and track the
   second through the scheduled meeting or project task—not a vague duplicate.
2. Open the executed Contract/SOW and add an amendment-log entry such as:
   `Requested Phase 2 addition: offline barcode scanning for three customer formats; subject to IT approval, separate quote, payment, and acceptance criteria. QuickBooks remains unapproved discovery.`
3. Open the Project's Phase 2 and choose **Request a change**.
4. Name it `Offline equipment barcode scanning` and include the device, offline,
   sync, three-format, and acceptance details.
5. As Wahala, send a simulated $18,000 change quote. Added duration: two weeks.
   If the UI has no duration field on the change card, put the duration in the
   description; do not hide it.
6. Role-play Priya approving the change, mark the simulated payment received, and
   apply the change through the change-order workflow.
7. Use **Activate & amend** for Phase 2 only after Phase 1 is complete and the
   Phase 2 change is approved.
8. Ensure barcode work becomes a visible delivery task/change item.
9. Do not add QuickBooks to Phase 3 until discovery, pricing, approval, and payment
   complete. A customer's request is not an authorized change.

The revised commercial total is $198,000 only after the $18,000 change is approved.
The original executed amount remains historical truth; the amendment/change order
explains the difference.

## Pass conditions

- The trainee does not casually edit the executed original.
- Barcode scanning and QuickBooks are treated as separate decisions.
- No work begins from “Priya is willing” without quote, approval, and payment.
- Phase 2 remains gated until Phase 1 acceptance and the change decision.
- The client-visible delivery record shows what changed, what it cost, and what
  acceptance means.

---

# Facilitator scorecard

Score each category 0, 1, or 2. A passing exercise requires at least 16/20 and no
automatic-fail behavior.

| Category | 0 | 1 | 2 |
|---|---|---|---|
| Opportunity hygiene | Duplicates or missing owner/contact | Record exists but needs cleanup | Clean fictional contact, account, owner, source, value, and need |
| Conversation quality | Feature pitch/interrogation | Finds some useful facts | Natural business → workflow → pain → scope → buying conversation |
| Evidence discipline | Invents or blindly applies AI output | Catches some gaps | Every accepted fact is supported and sources remain visible |
| Discovery Package | Statuses do not match evidence | Mostly complete | OK/Partial/Missing accurately reflect all eight fields |
| Buying path | Confuses enthusiasm with authority/funding | Some roles/process known | Champion, buyer, event, process, and funding are independently supported |
| Customer motion | Vague “follow up” | Action but weak ownership/date | Concrete accepted action, owner/court, and exact date |
| Proposal judgment | Sends AI output unchanged | Reviews major fields | Validates scope, coverage, acceptance, exclusions, terms, and human price |
| Commercial safety | Promises IP/security/support casually | Records risks | Makes ownership, data, third parties, support, and gates explicit |
| Contract-to-project | Treats proposal approval as Won | Completes most gates | Executes simulated paper/payment and creates Project deliberately |
| Change control | Rewrites history or starts free work | Logs a note | Separates request, amendment, quote, approval, payment, and delivery |

Automatic fail:

- entering real personal data or sending a test email to a real customer;
- marking contradictory evidence OK without resolution;
- claiming the AI, CRM, or salesperson has legal authority to transfer IP;
- sending a proposal with an unreviewed AI price or unsupported scope;
- marking funds confirmed without buyer evidence;
- starting changed work before approval/payment; or
- deleting or rewriting an executed commercial record to hide a change.

## Debrief questions

1. Which facts were scope evidence, and which were buying evidence?
2. Where did AI help, and where did human judgment override or reject it?
3. What would have caused delivery failure if it were discovered after signature?
4. What promise did the trainee deliberately avoid making?
5. Is the current next commitment observable, owned, and dated?
6. What does the Discovery score prove, and what does it not prove?
7. Would Wahala still want this deal after considering delivery risk and support?
