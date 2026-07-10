/**
 * Master Services Agreement boilerplate (docs/MSA.docx, v1.0) as a merge template.
 *
 * Where the MSA fits: it's the ACCOUNT-level umbrella contract — relationship
 * terms signed ONCE per client (liability, IP, confidentiality, payment defaults,
 * governing law). Money and scope deliberately live elsewhere: each engagement's
 * SOW / commercial proposal rides on top of it (§1 order of precedence). That's
 * why the agreements table treats `msa` as account-level and later deals go
 * "MSA on file · SOW only".
 *
 * The filled document renders on demand from live account data (no snapshot
 * column): the signed source of truth is the executed copy (DocuSign later);
 * this page is the boilerplate you send. Legal-text edits happen HERE, bump
 * MSA_TEMPLATE_VERSION when they do.
 */

export const MSA_TEMPLATE_VERSION = "1.0";

export type MsaFields = {
  clientName: string;
  /** Formatted date string (e.g. "July 10, 2026") — signedAt when signed, else today. */
  effectiveDate: string;
  wahalaRepName?: string | null;
  wahalaRepTitle?: string | null;
  clientRepName?: string | null;
  clientRepTitle?: string | null;
};

const blank = "____________________";

export function msaMarkdown(f: MsaFields): string {
  const clientName = f.clientName.trim() || "Client Name";
  return `# Master Services Agreement

This Master Services Agreement ("Agreement") is entered into as of **${f.effectiveDate}** (the "Effective Date") by and between:

**Wahala Group, LLC** ("Wahala")

and

**${clientName}** ("Client")

collectively referred to as the "Parties."

## 1. Purpose

This Agreement establishes the general terms and conditions governing professional services provided by Wahala to Client.

Individual projects shall be authorized through one or more Statements of Work ("SOW"), Change Orders, or other written agreements that reference this Agreement.

In the event of any conflict, the following order of precedence shall apply:

- Executed Change Order
- Executed Statement of Work
- Commercial Proposal
- This Master Services Agreement

## 2. Services

Wahala may provide professional services including, but not limited to:

- Software Engineering
- Artificial Intelligence Engineering
- Cloud Architecture
- System Design
- Product Development
- API Development
- Data Engineering
- Infrastructure Engineering
- Security Consulting
- DevOps Services
- Technical Consulting
- Product Strategy
- Technical Assessments
- Training
- Managed Services

The specific services to be provided shall be described in each applicable Statement of Work.

## 3. Statements of Work

Each Statement of Work shall define, as applicable:

- Project objectives
- Deliverables
- Scope
- Assumptions
- Timeline
- Milestones
- Acceptance criteria
- Pricing
- Payment schedule
- Special project requirements

No work shall begin until an authorized Statement of Work has been executed unless otherwise agreed in writing.

## 4. Commercial Terms

Fees, payment schedules, and billing arrangements shall be defined within each Statement of Work.

Unless otherwise stated:

- Invoices are due within thirty (30) days.
- Late payments may accrue interest at the maximum rate permitted by law.
- Wahala may suspend work for materially overdue invoices after providing written notice.

## 5. Change Management

Any request that materially changes:

- Scope
- Timeline
- Deliverables
- Integrations
- Technical approach
- Assumptions

shall require an executed Change Order before the additional work begins.

Wahala is not obligated to perform work outside the approved scope without a signed Change Order.

## 6. Client Responsibilities

Client agrees to:

- Provide timely decisions and approvals.
- Designate an authorized project representative.
- Supply required information and documentation.
- Provide access to required systems.
- Participate in scheduled project reviews.
- Perform acceptance testing within agreed timelines.

Project delays caused by Client may require schedule adjustments.

## 7. Project Acceptance

Each Statement of Work shall define acceptance criteria.

Unless otherwise specified, deliverables shall be deemed accepted if Client does not provide written notice of material deficiencies within ten (10) business days following delivery.

Wahala shall have a reasonable opportunity to correct any verified deficiencies before acceptance is withheld.

## 8. Intellectual Property

Ownership shall be defined within each Statement of Work.

Unless otherwise stated, Wahala retains ownership of:

- Pre-existing software
- Internal frameworks
- Libraries
- Utilities
- Development tools
- Templates
- Methodologies
- AI workflows
- Generic reusable components

Client retains ownership of:

- Client Data
- Client branding
- Client confidential information

Ownership of project-specific deliverables shall be specified in the applicable Statement of Work.

## 9. Confidentiality

Each Party agrees to protect confidential information received from the other Party using reasonable care.

Confidential information shall not be disclosed except:

- to employees or contractors with a need to know;
- as required by law; or
- with prior written consent.

These obligations survive termination of this Agreement.

## 10. Data Security

Wahala will implement commercially reasonable administrative, technical, and organizational safeguards appropriate to the services provided.

Where applicable, additional security obligations may be documented in:

- Security Addendum
- Data Processing Agreement
- Statement of Work

## 11. Independent Contractor

Wahala is an independent contractor.

Nothing in this Agreement creates:

- Employment
- Joint Venture
- Partnership
- Agency Relationship

## 12. Warranties

Wahala warrants that professional services will be performed in a professional and workmanlike manner consistent with generally accepted industry standards.

Except as expressly stated herein, all other warranties, including implied warranties of merchantability or fitness for a particular purpose, are disclaimed to the fullest extent permitted by law.

## 13. Limitation of Liability

To the fullest extent permitted by law, neither Party shall be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, including lost profits, revenue, goodwill, or business interruption.

Except for obligations related to confidentiality, intellectual property, fraud, or willful misconduct, each Party's aggregate liability under this Agreement shall not exceed the total fees paid by Client under the applicable Statement of Work giving rise to the claim.

## 14. Indemnification

Each Party agrees to indemnify the other for claims arising from:

- its negligence;
- willful misconduct; or
- violation of applicable law,

subject to the procedures set forth in the applicable Statement of Work or applicable law.

## 15. Force Majeure

Neither Party shall be liable for delays caused by events beyond its reasonable control, including natural disasters, labor disputes, government actions, cyberattacks, internet outages, or utility failures.

## 16. Term and Termination

This Agreement remains in effect until terminated by either Party upon thirty (30) days written notice.

Termination of this Agreement does not affect any active Statement of Work unless specifically agreed.

Client shall pay for all work performed through the effective termination date.

## 17. Non-Solicitation

During the term of this Agreement and for twelve (12) months thereafter, neither Party shall knowingly solicit for employment personnel assigned by the other Party to perform services under an active Statement of Work without prior written consent.

## 18. Publicity

Neither Party shall use the other's name, logo, or trademarks in marketing materials without prior written consent, except as required by law.

## 19. Governing Law

This Agreement shall be governed by the laws of the State of Florida without regard to conflict of law principles.

Venue shall lie in the state or federal courts located in Brevard County, Florida, unless otherwise agreed.

## 20. Entire Agreement

This Agreement, together with any executed Statements of Work, Change Orders, and incorporated schedules, constitutes the entire agreement between the Parties and supersedes all prior discussions, proposals, or agreements relating to its subject matter.

Amendments must be in writing and signed by authorized representatives of both Parties.

## Signatures

**Wahala Group, LLC**

Authorized Representative: ${f.wahalaRepName?.trim() || blank}

Title: ${f.wahalaRepTitle?.trim() || blank}

Signature: ${blank}

Date: ${blank}

**Client — ${clientName}**

Authorized Representative: ${f.clientRepName?.trim() || blank}

Title: ${f.clientRepTitle?.trim() || blank}

Signature: ${blank}

Date: ${blank}
`;
}
