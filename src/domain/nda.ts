/**
 * Mutual NDA boilerplate (docs/Wahala_Group_Standard_Mutual_NDA.docx, v1.0) as a
 * merge template.
 *
 * Where the NDA fits: account-level like the MSA — signed ONCE per counterparty,
 * usually the FIRST thing signed (it protects discovery conversations before any
 * money moves). §10 hands confidentiality off to the MSA when that lands, so the
 * two never conflict. The agreements table treats `nda` as account-level.
 *
 * The filled document renders on demand from live account data (no snapshot
 * column): the signed source of truth is the executed copy (DocuSign later);
 * this page is the boilerplate you send. Legal-text edits happen HERE, bump
 * NDA_TEMPLATE_VERSION when they do.
 */

export const NDA_TEMPLATE_VERSION = "1.0";

export type NdaFields = {
  counterpartyName: string;
  /** Formatted date string (e.g. "July 10, 2026") — signedAt when signed, else today. */
  effectiveDate: string;
  wahalaRepName?: string | null;
  wahalaRepTitle?: string | null;
  clientRepName?: string | null;
  clientRepTitle?: string | null;
};

const blank = "____________________";

export function ndaMarkdown(f: NdaFields): string {
  const counterparty = f.counterpartyName.trim() || "Counterparty Legal Name";
  return `# Mutual Non-Disclosure Agreement

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of **${f.effectiveDate}** (the "Effective Date") by and between **Wahala Group LLC**, a Florida limited liability company with its principal place of business at ${blank} ("Wahala Group"), and **${counterparty}**, with its principal place of business at ${blank} ("Counterparty"). Wahala Group and Counterparty are each a "Party" and together the "Parties."

**Recitals.** The Parties wish to explore or carry out a potential business relationship involving the design, development, deployment, hosting, and/or licensing of software, custom hardware, and related technology services — including custom application development, embedded and custom hardware systems, application programming interfaces, and software-as-a-service offerings (the "Purpose"). In connection with the Purpose, each Party may disclose to the other certain confidential and proprietary information. The Parties agree to protect that information on the terms below.

## 1. Definition of Confidential Information

"Confidential Information" means any non-public information disclosed by one Party ("Disclosing Party") to the other ("Receiving Party"), whether disclosed orally, in writing, electronically, visually, or by inspection, that is designated as confidential or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure. Confidential Information includes, without limitation:

- Technical information, including source code, object code, algorithms, system architecture, data models, API specifications, hardware schematics, circuit designs, firmware, prototypes, test results, security designs, and engineering documentation;
- Business information, including business plans, financial information, pricing, customer and vendor lists, marketing strategies, and product roadmaps;
- Operational information disclosed in connection with evaluating or performing services, including a Disclosing Party's facility layouts, physical security procedures, network configurations, inventory data, and other internal business processes; and
- The existence, nature, and status of the discussions between the Parties.

## 2. Exclusions

Confidential Information does not include information that the Receiving Party can demonstrate: (a) was already known to it without an obligation of confidentiality before disclosure by the Disclosing Party; (b) is or becomes publicly available through no fault of the Receiving Party; (c) is independently developed by the Receiving Party without use of or reference to the Disclosing Party's Confidential Information; or (d) is rightfully received from a third party without an obligation of confidentiality.

## 3. Obligations of Receiving Party

The Receiving Party shall:

- use Confidential Information solely to evaluate or carry out the Purpose;
- protect Confidential Information using at least the same degree of care it uses for its own confidential information of a similar nature, and in no case less than a reasonable degree of care;
- not disclose Confidential Information to any third party without the Disclosing Party's prior written consent; and
- limit access to Confidential Information to employees, contractors, and advisors who have a need to know it for the Purpose and who are bound by confidentiality obligations at least as protective as those in this Agreement.

Each Party remains responsible for any breach of this Agreement by its employees, contractors, or advisors.

## 4. Compelled Disclosure

If the Receiving Party becomes legally compelled to disclose Confidential Information (by court order, subpoena, or similar legal process), it shall, to the extent legally permitted, give the Disclosing Party prompt written notice so the Disclosing Party may seek a protective order or other remedy, and shall disclose only the portion of Confidential Information legally required.

## 5. No License; No Obligation

Nothing in this Agreement grants the Receiving Party any right, title, license, or interest in or to the Disclosing Party's Confidential Information, patents, copyrights, trademarks, trade secrets, or other intellectual property, other than the limited right to use Confidential Information for the Purpose. Nothing in this Agreement obligates either Party to disclose any particular information, to enter into any further agreement, or to proceed with any potential transaction.

## 6. No Warranty

All Confidential Information is provided "as is." Neither Party makes any representation or warranty as to the accuracy or completeness of any Confidential Information it discloses.

## 7. Term

This Agreement is effective as of the Effective Date and continues for two (2) years, unless earlier terminated by either Party on thirty (30) days' written notice. Each Party's confidentiality obligations with respect to Confidential Information disclosed during the term of this Agreement survive termination or expiration of this Agreement for three (3) years from the date of disclosure, except that Confidential Information constituting a trade secret under applicable law remains protected for as long as it retains trade secret status.

## 8. Return or Destruction of Materials

Upon the Disclosing Party's written request, or upon termination of discussions regarding the Purpose, the Receiving Party shall promptly return or destroy all materials containing the Disclosing Party's Confidential Information and, if requested, certify such destruction in writing — except that the Receiving Party may retain one copy in its legal files solely to demonstrate compliance with this Agreement, and may retain copies created through routine backup or archival processes, subject to the confidentiality obligations of this Agreement.

## 9. Remedies

Each Party acknowledges that unauthorized use or disclosure of Confidential Information may cause irreparable harm for which monetary damages would be an inadequate remedy, and that the Disclosing Party is entitled to seek injunctive relief, in addition to any other remedies available at law or in equity, without the necessity of posting a bond.

## 10. Relationship to Future Agreements

If the Parties later enter into a Master Services Agreement, Statement of Work, or other definitive written agreement addressing confidentiality of information disclosed in connection with the Purpose, the confidentiality provisions of that later agreement supersede this Agreement as of its effective date, except that confidentiality obligations for information disclosed before that date continue to be governed by whichever agreement affords greater protection.

## 11. General Provisions

(a) **Governing Law.** This Agreement is governed by the laws of the State of Florida, without regard to its conflict of laws principles.

(b) **Entire Agreement.** This Agreement constitutes the entire agreement between the Parties regarding its subject matter and supersedes all prior discussions or agreements regarding confidentiality, except as expressly stated in a later written agreement between the Parties that references this Agreement.

(c) **Assignment.** Neither Party may assign this Agreement without the other Party's prior written consent, except in connection with a merger, acquisition, or sale of substantially all assets.

(d) **No Publicity.** Neither Party shall use the other Party's name or refer to the existence of this Agreement or the discussions between the Parties in any public statement without the other Party's prior written consent.

(e) **Severability.** If any provision of this Agreement is held unenforceable, the remaining provisions remain in full force and effect.

(f) **Counterparts.** This Agreement may be executed in counterparts, including electronic signatures, each of which is deemed an original.

(g) **Notices.** Notices under this Agreement shall be in writing and delivered to the addresses set out above or such other address as a Party designates in writing.

## 12. Signatures

By signing below, the Parties agree to the terms of this Mutual Non-Disclosure Agreement.

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
