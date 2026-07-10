/**
 * Professional Services Terms boilerplate
 * (docs/Wahala_Group_Standard_Professional_Services_Terms.docx, v1.0) as a
 * merge template.
 *
 * Where it fits: the standing DELIVERY RULEBOOK that rides on the MSA — how
 * deliverables get accepted (5-day review window), the change-order process,
 * standard exclusions, the 60-day warranty, personnel/site rules, and the
 * order of precedence across the whole document stack. Signed once alongside
 * the MSA; SOWs only state what's specific to the engagement.
 *
 * Legal-text edits happen HERE, bump PS_TERMS_TEMPLATE_VERSION when they do.
 */

export const PS_TERMS_TEMPLATE_VERSION = "1.0";

export type PsTermsFields = {
  counterpartyName: string;
  /** Formatted date string — signedAt when signed, else today. */
  effectiveDate: string;
  /** The account MSA's signed date, if on file. */
  msaDate?: string | null;
  wahalaRepName?: string | null;
  wahalaRepTitle?: string | null;
  clientRepName?: string | null;
  clientRepTitle?: string | null;
};

const blank = "____________________";

export function psTermsMarkdown(f: PsTermsFields): string {
  const counterparty = f.counterpartyName.trim() || "Counterparty Legal Name";
  const msaDate = f.msaDate?.trim() || blank;
  return `# Professional Services Terms

These Professional Services Terms ("Terms") are entered into as of **${f.effectiveDate}** by and between **Wahala Group LLC**, a Florida limited liability company ("Wahala Group"), and **${counterparty}** ("Client"), pursuant to and incorporated by reference into the Master Services Agreement between the parties dated **${msaDate}** (the "MSA"). Capitalized terms not defined here have the meaning given in the MSA.

## 1. Purpose

These Terms set out the standard operating rules that apply to every Statement of Work ("SOW") executed by the parties under the MSA — how deliverables are reviewed and accepted, how scope changes are handled, standard exclusions, warranty, personnel, and site-access rules. Individual SOWs describe the specific phases, deliverables, acceptance criteria, price, and schedule for a given engagement, and do not need to restate the rules in these Terms.

## 2. Order of Precedence

If there is a conflict among the documents governing an engagement, the following order of precedence applies, from highest to lowest: (a) the MSA, for liability, indemnification, confidentiality, intellectual property ownership defaults, warranties, and termination; (b) the applicable SOW, for the scope of services, deliverables, acceptance criteria, fees, and schedule specific to that engagement; (c) these Professional Services Terms, for delivery mechanics not otherwise stated in the applicable SOW; and (d) the Commercial Agreement, for pricing and payment mechanics not otherwise stated in the applicable SOW. A SOW may expressly deviate from these Terms for that engagement only by stating so explicitly; silence in a SOW means these Terms apply.

## 3. Deliverable Review & Acceptance

Unless a SOW states a different review period, Client will review each deliverable or phase within five (5) business days of delivery. If Client does not provide written notice of material deficiencies within that window, the deliverable is deemed accepted and any associated milestone payment becomes due. If Client provides timely written notice of material deficiencies, Wahala Group will correct them and redeliver within a reasonable time, after which the review period restarts for the corrected deliverable only.

## 4. Change Order Process

Any request to add, remove, or materially modify the services, deliverables, timeline, or fees described in a SOW must be documented in a written Change Order describing the requested change and its impact on scope, schedule, and fees. A Change Order becomes effective only upon signature by an authorized representative of each party, and no work outside the scope of the applicable SOW will begin until the corresponding Change Order is executed.

## 5. Standard Exclusions

Unless a SOW or a signed Change Order expressly states otherwise, the following are excluded from every engagement under the MSA:

- Ongoing operational support, maintenance, hosting, or monitoring following completion of the applicable SOW.
- Feature work, integrations, or enhancements outside the scope described in the applicable SOW.
- Custom AI/ML model training beyond what is expressly described in the applicable SOW.
- Legal, regulatory, or compliance certification services (e.g., SOC 2, HIPAA, PCI-DSS attestation).
- Marketing or sales enablement activities.

A SOW may list additional exclusions specific to that engagement; those are in addition to, not in place of, the standard exclusions above.

## 6. Client Responsibilities

For each engagement, Client will:

- designate a business owner and a technical point of contact with authority to make scope and acceptance decisions;
- provide timely access to systems, data, subject-matter experts, credentials, and environments reasonably needed to perform the services;
- review deliverables and respond to acceptance requests within the review window described in Section 3; and
- provide timely feedback and approvals at each phase gate described in the applicable SOW.

Delays in Client's responsibilities under this Section may result in corresponding schedule adjustments, and will not be treated as a delay caused by Wahala Group.

## 7. Personnel & Subcontracting

Wahala Group may perform services using its employees or subcontractors, provided that each is bound by confidentiality obligations at least as protective as those in the MSA. Wahala Group remains responsible for the performance of any subcontractor as if performed by Wahala Group directly. For engagements involving access to Client's premises, systems, or sensitive facilities (including installation of surveillance or security hardware), Client may reasonably request that assigned personnel complete a background check or site-specific security screening before gaining access, at Client's expense unless otherwise agreed in the applicable SOW.

## 8. Site Access & On-Premises Work

Where a SOW requires Wahala Group personnel to work at Client's premises (for example, to install or configure custom hardware), Client will provide safe and reasonable access to the work areas, will disclose any site-specific safety, security, or access requirements in advance, and will ensure the work environment is reasonably fit for the work to be performed. Wahala Group personnel will comply with Client's reasonable, previously-disclosed site rules while on Client's premises.

## 9. Warranty on Services

Wahala Group warrants that services under each SOW will be performed in a professional and workmanlike manner consistent with prevailing industry standards. For sixty (60) days following Client's acceptance of a deliverable, Wahala Group will correct, at no additional charge, any material defect in that deliverable that is reported in writing within the warranty period, provided the defect is not caused by Client's modification of the deliverable, misuse, or integration with third-party systems outside Wahala Group's control. This warranty is Client's exclusive remedy, and Wahala Group's sole obligation, for defects in delivered work product, without limiting any remedies available under the MSA for other breaches.

## 10. Intellectual Property in Deliverables

Unless the MSA or applicable SOW states otherwise, and subject to Client's payment in full for the applicable SOW, work product created specifically for Client under that SOW is owned by Client upon full payment. This does not include Wahala Group's pre-existing tools, frameworks, libraries, hardware reference designs, or methodologies ("Background IP"), which remain Wahala Group's property and are licensed to Client, on a non-exclusive, royalty-free basis, solely to use, operate, and maintain the delivered solution.

## 11. Suspension of Work

Wahala Group may suspend performance under any SOW if payment is more than fifteen (15) days overdue, upon written notice to Client, in accordance with Section 7(c) of the Commercial Agreement. A suspension under this Section does not constitute a breach of any schedule commitment in the applicable SOW, and any deadlines affected by the suspension are extended by the length of the suspension.

## 12. General Provisions

(a) **Term.** These Terms remain in effect for as long as the MSA remains in effect and apply to every SOW executed during that time, unless the parties agree in writing to different terms for a specific SOW.

(b) **Governing Law.** These Terms are governed by the laws of the State of Florida, without regard to its conflict of laws principles.

(c) **Amendment.** Wahala Group may update these Terms by giving Client at least sixty (60) days' written notice; updates apply to SOWs executed after the notice period and do not change the terms of a SOW already in effect.

(d) **Entire Agreement.** These Terms, together with the MSA, the Commercial Agreement, and any executed SOWs, constitute the entire understanding between the parties regarding how engagements are delivered.

(e) **Counterparts.** These Terms may be executed in counterparts, including electronic signatures, each of which is deemed an original.

## 13. Signatures

By signing below, the parties agree to the standard professional services terms described in this document.

**Wahala Group LLC**

Name: ${f.wahalaRepName?.trim() || blank}

Title: ${f.wahalaRepTitle?.trim() || blank}

Signature: ${blank}

Date: ${blank}

**${counterparty}**

Name: ${f.clientRepName?.trim() || blank}

Title: ${f.clientRepTitle?.trim() || blank}

Signature: ${blank}

Date: ${blank}
`;
}
