# Simulation 1: Product license and code handoff

This is the recommended first exercise for a new Wahala employee. Follow the
steps in order and do not skip a checkpoint because the answer seems obvious.

[Return to the simulation lab](DEAL-SIMULATION-LAB.md)

## Scenario

| Item | Training value |
|---|---|
| Exercise ID | WG-TRAIN-01 |
| Fictional customer | Atlantic Verbatim Services |
| Primary contact | Nina Brooks, Operations Director |
| Other participant | Evan Cho, Owner |
| Deal type | Existing deposition speech-to-text product license and configured code-fork handoff |
| Delivery | One delivery with enablement; optional support priced separately |
| Estimated value | $65,000 |
| Source | Referral |
| Main lesson | Separate handoff, customer infrastructure, IP intent, acceptance, and support |

## Step 1 — Prepare the exercise

- [ ] Turn on **Training mode** from the sidebar.
- [ ] Confirm you will not enter a real email address.
- [ ] If a facilitator is present, have them read Nina and Evan. The trainee reads
  only the Wahala lines.
- [ ] If working solo, paste each complete transcript into **Log a call** when its
  step instructs you to do so.

## Step 2 — Create the opportunity

Go to **Sales → + New opportunity** and enter:

| Field | Value |
|---|---|
| Contact | `Nina Brooks` |
| Account | `[TRAINING] Atlantic Verbatim Services` |
| What they need | `License a configured deposition speech-to-text platform, transfer a repository fork, and enable deployment in customer-owned accounts.` |
| Estimated value | `$65,000` |
| Source | `Referral` |
| Owner | Yourself |
| Email | Leave blank |

- [ ] If Nina or the account does not exist, deliberately confirm their creation.
- [ ] Open the opportunity and confirm the contact/account were not duplicated.
- [ ] Select **Accept → start Discovery**. Nina requested a specific product-purchase
  conversation, so Discovery effort is justified. This does not prove authority,
  budget, or fit.

## Step 3 — Conduct and log Call 1

Create a call titled `Atlantic Verbatim — business discovery`. Role-play or paste
this full transcript:

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

- [ ] Save the call and wait for AI analysis.
- [ ] Open the AI review. Read every suggestion before applying it.
- [ ] Apply only statements supported by the transcript.
- [ ] Select the agreed follow-up because Nina accepted concrete owners and dates.

### Checkpoint after Call 1

Before continuing, verify:

- Nina is the **champion**, not the economic buyer.
- Evan may be recorded as the likely economic buyer, but Partial is reasonable
  until Evan confirms directly.
- Funding is **Funding path identified**, not Budget confirmed.
- Data sensitivity is **High-risk / regulated data**.
- “Configured fork” records commercial intent; it does not prove Wahala's legal
  authority to license every component.
- The desired six-week timing is a buyer request, not a Wahala commitment.

## Step 4 — Conduct and log Call 2

Create a call titled `Atlantic Verbatim — buyer and handoff confirmation`:

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

- [ ] Save the call and review the AI analysis.
- [ ] Update existing evidence only where Call 2 genuinely strengthens it.
- [ ] Do not allow a call summary to replace more precise evidence with vague text.

## Step 5 — Complete Proposal Readiness

Open the **Discovery Package** and verify all eight items. Correct wording is more
important than matching these sentences exactly.

| Discovery item | Status | Evidence that must be present |
|---|---|---|
| Business profile | OK | Coordinates about forty court reporters producing deposition transcripts |
| Current workflow | OK | Email, shared drives, and spreadsheet board track intake through editing |
| Pain points | OK | Missing files, conflicting drafts, stale status, and missed dates |
| Success metrics | OK | Ten proceedings; at least nine usable rough drafts; no cross-reporter access |
| MVP priorities | OK | Reporter RBAC, upload, speech-to-text, editing, ready flag, operations status |
| Timeline | OK | Customer inputs October 13; desired six weeks remains subject to review |
| Customer terminology | OK | Proceeding, reporter, rough draft, final transcript, board |
| Deferred scope | OK | Certification, billing, scheduling, scopist role, legacy integration, future work |

- [ ] Confirm **Discovery 10/10**. Remember: this means scope discovery is complete,
  not that the customer will buy.

Verify the **Buying path** separately:

| Buying-path item | Status | Evidence |
|---|---|---|
| Champion | OK | Nina leads evaluation, reviewers, and acceptance |
| Economic buyer | OK | Evan owns Atlantic, approves funds, and signs |
| Compelling event | OK | Lost referral, late jobs, and January renewal discussions |
| Decision process | OK | Nina → IT → attorney → Evan |
| Funding path | Budget confirmed | Evan confirms $75,000 is approved and available |

- [ ] Confirm the Buying path reads **Confirmed**.
- [ ] Record the current dated agreed follow-up.

## Step 6 — Complete the Deal record

Enter or verify:

| Field | Training value |
|---|---|
| Engagement type | Product license / transfer |
| Delivery model | License plus enablement |
| IP disposition | Non-exclusive license only if simulated counsel approves; otherwise Undecided |
| Data sensitivity | High-risk / regulated data |
| Support expectation | 30-day defect correction against acceptance; later support separately priced |
| Expected close | A training date consistent with this exercise |

Do not select **Client owns configured fork**. The fictional buyer requested a
license and maintenance rights, not ownership of Wahala's reusable platform.

## Step 7 — Create and review the rough proposal

- [ ] Select **Rough out draft with AI**.
- [ ] Use one commercial option. The customer described one coherent purchase,
  not two meaningful alternatives.
- [ ] Enter the human-approved simulation price: **$65,000**.
- [ ] Do not send yet.

The option must include:

- configured repository fork and a defined license boundary;
- customer-owned account setup and CI/CD enablement;
- deployment/configuration documentation and knowledge transfer;
- all six MVP capabilities and the ten-proceeding acceptance test;
- third-party operating costs and explicit exclusions;
- a duration reviewed by engineering; and
- no claim that the CRM proves Wahala has legal authority to license the IP.

- [ ] Inspect the MVP coverage review and correct unsupported classifications.
- [ ] Remove repeated, vague, or conflicting items.
- [ ] Use the **Staff/Client** switcher and read the complete client view.
- [ ] Verify internal buying commentary is not visible to the customer.

## Step 8 — Send and approve the proposal

- [ ] Send the proposal only after completing the review.
- [ ] Open the public link in a private/incognito window. Do not email it.
- [ ] Role-play Nina selecting and approving the single-delivery option.
- [ ] Return to staff view and confirm the approval is visible.

## Step 9 — Complete simulated contracting

- [ ] Generate the Contract/SOW.
- [ ] Confirm the license boundary, acceptance, exclusions, customer accounts,
  support period, and price survived generation.
- [ ] Mark the fictional contract sent and executed for training.
- [ ] Complete the simulated agreement checklist.
- [ ] Record the 30% deposit: **$19,500**.
- [ ] Mark the fictional deposit sent and paid.

Never perform these status changes on a real deal without the real-world event.

## Step 10 — Create the Project and verify Won

- [ ] Select **Create project →** only after the simulated gates are satisfied.
- [ ] Confirm the Project has one paid delivery phase.
- [ ] Confirm the Deal became **Won because the Project was created**, not because
  the proposal was approved.

## Step 11 — Evaluate and clean up

The exercise passes only if the trainee:

- distinguishes speech-to-text from text-to-speech;
- keeps support from becoming an unlimited obligation;
- makes customer-owned infrastructure and third-party billing explicit;
- records IP intent without claiming provenance is solved; and
- can explain why Discovery 10/10 and Buying path Confirmed measure different
  things.

- [ ] Review the [facilitator scorecard](DEAL-SIMULATION-LAB.md#facilitator-scorecard).
- [ ] Archive or delete the fictional records according to the available controls.
- [ ] Return Training mode to the team's normal setting.
