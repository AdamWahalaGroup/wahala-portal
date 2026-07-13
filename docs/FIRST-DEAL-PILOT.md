# First Deal pilot: deposition speech-to-text platform

> Internal working brief. Move verified facts into the CRM as they are learned.
> Do not add buyer names, private contact information, credentials, or legal
> advice to this repository.

## Known from founder discussions

- Wahala has built a speech-to-text platform aimed at depositions.
- The application is deployed on Cloudflare and its code is in GitHub.
- The prospective customer is a transcription agency.
- The intended transaction includes a repository fork plus CI/CD and deployment
  enablement for the customer's domain.
- The founders hope to complete a transaction within roughly one month.

Everything else—including price, authority, budget, acceptance, and ownership
rights—remains unverified until supported by buyer or legal evidence.

## Non-negotiable gate before proposal

Wahala must be able to demonstrate that it owns or may license every component
included in the transaction. A CRM field cannot establish legal ownership.

Review with qualified counsel:

- employment, contractor, and prior-client agreements affecting the code;
- contributor identities and invention/IP assignments;
- repository history and code provenance;
- open-source packages, licenses, notices, and source-disclosure obligations;
- third-party APIs, models, fonts, datasets, and commercial components;
- whether any sample, training, deposition, or customer data is included;
- trademarks, domains, documentation, infrastructure, and deployment scripts;
- background IP Wahala must retain for future work;
- customer-specific IP that may be transferred or licensed;
- exclusivity, territory, sublicensing, resale, and derivative-work rights; and
- warranties, indemnity, infringement response, and liability limits.

Until that review is complete, CRM `ipDisposition` stays `undecided`.

## Recommended starting commercial structure

Use one recommended path unless the buyer identifies a real tradeoff:

1. A defined license or transfer of the configured customer fork—not a casual
   assignment of all Wahala methods, templates, or reusable background IP.
2. Repository handoff and ownership-transfer procedure.
3. CI/CD and customer-domain deployment enablement.
4. Environment/configuration documentation and a knowledge-transfer session.
5. Objective acceptance tests and a short acceptance window.
6. A limited defect-correction or warranty period.
7. Optional ongoing support with scope, response expectations, exclusions, and
   pricing separate from the one-time transaction.

The final structure, representations, and contract language require counsel.

## Discovery meeting outcome

The meeting succeeds only if it ends with buyer evidence and a dated mutual
commitment. Cover:

### Buying motion

- What operational or financial problem makes this worth buying now?
- What happens if the agency does nothing?
- Who is the internal champion?
- Who can approve the purchase and sign?
- Is money allocated? What evidence supports that?
- What are the decision steps, participants, criteria, and target date?
- What alternatives—including internal build and no decision—are being weighed?

### Product and acceptance

- Which deposition/transcription workflows must work on day one?
- What accuracy, latency, speaker identification, export, and review outcomes
  define acceptance?
- What volume, concurrency, file formats, browsers, and devices matter?
- Which capabilities are required versus deferred?
- Who runs acceptance, with what test data, and within what time window?

### Data and security

- Does the system handle privileged, confidential, biometric, regulated, or
  court-protected material?
- Where may audio, transcripts, logs, and backups be processed and stored?
- Which model and infrastructure providers are allowed?
- What consent, retention, deletion, legal-hold, access, and incident rules apply?
- What security review, insurance, or contractual controls will the buyer require?

### Handoff and support

- Which GitHub organization, Cloudflare account, domain, email, and third-party
  accounts will the buyer own?
- Who supplies credentials and performs each transfer step?
- Is Wahala responsible for migration, training, monitoring, or production launch?
- What support is expected after acceptance, for how long, and at what service level?
- What does the buyer expect if a third-party API or model changes?

## Initial CRM record

Use these values only where facts support them:

| Field | Initial value |
|---|---|
| Stage | New |
| Engagement type | Product license / code handoff |
| Delivery model | License and enablement |
| IP disposition | Undecided |
| Data sensitivity | High risk until proven otherwise |
| Budget status | Unknown |
| Support expectation | Unknown; must be separated from handoff price |
| Champion | Unknown |
| Economic buyer | Unknown |
| Decision process | Unknown |
| Expected close | Working target only; confirm with buyer |

Recommended first commitment:

> Wahala completes the IP/provenance inventory and schedules a buyer discovery
> meeting; owner and due date must be chosen by the founders.

## Pilot evidence to capture

- founder hours by sales gate;
- time between mutual commitments;
- buyer-caused and Wahala-caused delays;
- AI runs, cost, and whether suggestions were accepted;
- missing information that blocked proposal or contracting;
- legal/security work discovered late;
- proposed versus accepted scope and price; and
- win, loss, or park reason with supporting evidence.

Do not tune formulas from one result. Use the first Deal to expose workflow and
data-quality problems; use a cohort of closed Deals before claiming predictive
accuracy or employee performance conclusions.
