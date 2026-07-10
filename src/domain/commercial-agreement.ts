/**
 * Commercial Agreement boilerplate
 * (docs/Wahala_Group_Standard_Commercial_Agreement.docx, v1.0) as a merge
 * template.
 *
 * Where it fits: the standing PRICING & PAYMENT framework that rides on the
 * MSA — rate card, deposits, hardware markup, SaaS/API billing, Net-30, late
 * interest — so individual SOWs don't restate commercial mechanics. Signed
 * once alongside the MSA; a SOW that states different terms controls for that
 * engagement only.
 *
 * ⚠ The v1.0 rate card is the source doc's ILLUSTRATIVE PLACEHOLDERS (kept
 * bracketed, with the doc's own warning). Replace with the real rates HERE and
 * bump COMMERCIAL_AGREEMENT_TEMPLATE_VERSION.
 */

export const COMMERCIAL_AGREEMENT_TEMPLATE_VERSION = "1.0";

export type CommercialAgreementFields = {
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

export function commercialAgreementMarkdown(f: CommercialAgreementFields): string {
  const counterparty = f.counterpartyName.trim() || "Counterparty Legal Name";
  const msaDate = f.msaDate?.trim() || blank;
  return `# Commercial Agreement

This Commercial Agreement ("Agreement") is entered into as of **${f.effectiveDate}** by and between **Wahala Group LLC**, a Florida limited liability company ("Wahala Group"), and **${counterparty}** ("Client"), pursuant to and incorporated by reference into the Master Services Agreement between the parties dated **${msaDate}** (the "MSA"). Capitalized terms not defined here have the meaning given in the MSA.

## 1. Purpose

This Agreement sets out the standard pricing, invoicing, and payment framework that applies to all Statements of Work ("SOWs") executed by the parties under the MSA. It governs the commercial mechanics of the relationship at the account level so that individual SOWs do not need to restate them. Where a specific SOW expressly states different commercial terms for that engagement, the SOW controls for that engagement only; this Agreement continues to govern all other engagements.

## 2. Standard Rate Card

For work billed on a time-and-materials ("T&M") basis, or for out-of-scope work authorized by Change Order and billed on a T&M basis, Wahala Group's standard rates are:

| Role | Standard Rate |
| --- | --- |
| Principal Engineer / Solution Architect | [$220] / hour |
| Senior Software Engineer | [$185] / hour |
| Software Engineer | [$150] / hour |
| Hardware / Embedded Systems Engineer | [$175] / hour |
| QA / Test Engineer | [$135] / hour |
| Project Manager | [$160] / hour |

**⚠ Rates above are illustrative placeholders. Replace them with your actual rate card before use, and update Section 9 (Changes to Commercial Terms) if rates are expected to change periodically.**

## 3. Fixed-Price Engagements

(a) **Deposit.** Unless a SOW states otherwise, fixed-price engagements require a deposit of ten percent (10%) of the total SOW fee, due upon contract execution. The deposit is credited against the payment due at the first phase or milestone acceptance.

(b) **Milestone Payments.** The balance of a fixed-price SOW is invoiced upon Client's acceptance of each phase or milestone as defined in the applicable SOW, in the amounts stated there.

(c) **Rate Changes.** Fixed prices stated in an executed SOW do not change during that SOW's term, regardless of any later update to the rate card in Section 2.

## 4. Hardware, Components & Third-Party Costs

Where an engagement requires the purchase of hardware components, materials, equipment, or third-party licenses on Client's behalf, those costs are billed at Wahala Group's actual cost plus a fifteen percent (15%) handling fee, unless the applicable SOW states a fixed all-in price that already includes them. Wahala Group will seek Client's written approval before incurring any single hardware or component cost exceeding [$5,000].

## 5. Software-as-a-Service & Subscription Terms

(a) **Subscription Fees.** Fees for any Wahala Group SaaS offering are billed in advance on a [monthly/annual] cycle as stated in the applicable order form, and automatically renew for successive terms of the same length unless either party gives at least sixty (60) days' written notice of non-renewal before the end of the then-current term.

(b) **Price Changes.** Wahala Group may change subscription pricing effective at the next renewal by giving Client at least sixty (60) days' written notice before the renewal date. Price changes do not apply retroactively to the then-current paid term.

(c) **Suspension & Termination for Non-Payment.** Wahala Group may suspend access to a SaaS offering if payment is more than fifteen (15) days overdue, upon prior written notice, and may terminate the subscription if payment remains overdue more than thirty (30) days after that notice.

(d) **Refunds.** Fees are non-refundable except as required by law or as expressly stated in the applicable order form.

## 6. API & Usage-Based Services

Where Client is billed for API or usage-based access, usage is metered and billed in arrears on a monthly cycle at the rates stated in the applicable order form or rate card. Client is responsible for charges resulting from its use of any API keys or credentials it has been issued, whether or not authorized, until Client notifies Wahala Group in writing that a key has been compromised and should be revoked. Wahala Group may apply reasonable rate limits and may throttle or suspend access that it reasonably believes poses a security or stability risk to its platform.

## 7. Invoicing, Payment Terms & Late Payment

(a) **Payment Terms.** Invoices are due within thirty (30) days of the invoice date (Net 30), unless a SOW or order form states otherwise.

(b) **Currency & Method.** All fees are stated and payable in U.S. dollars by the payment method(s) Wahala Group makes available from time to time.

(c) **Late Payment.** Amounts not paid when due accrue interest at one and one-half percent (1.5%) per month, or the maximum rate permitted by law, whichever is lower, and Wahala Group may suspend work under any SOW (subject to the notice provisions of the Professional Services Terms) until payment is brought current.

(d) **Taxes.** Fees are exclusive of sales, use, VAT, and similar taxes. Client is responsible for all such taxes other than taxes on Wahala Group's net income.

(e) **Expenses.** Pre-approved travel and out-of-pocket expenses reasonably incurred in performing services are billed at cost, in addition to fees under the applicable SOW.

## 8. Disputed Charges

Client must notify Wahala Group in writing of any disputed charge within thirty (30) days of the invoice date, describing the basis for the dispute in reasonable detail. The parties will work in good faith to resolve disputed amounts promptly; undisputed amounts on the same invoice remain due on the original schedule.

## 9. Changes to Commercial Terms

Wahala Group may update the rate card and other standing commercial terms in this Agreement by giving Client at least sixty (60) days' written notice. Updated terms apply to SOWs, order forms, and subscription renewals executed or renewed after the notice period; they do not change the pricing of any SOW or order form already in effect.

## 10. Relationship to Other Agreements

This Agreement is incorporated into and governed by the MSA. As between this Agreement and any SOW, the SOW controls with respect to pricing, payment milestones, and schedule specific to that engagement; this Agreement controls for any commercial term a SOW does not address. As between this Agreement and the Professional Services Terms or the MSA, the order of precedence set out in the Professional Services Terms governs.

## 11. General Provisions

(a) **Term.** This Agreement remains in effect for as long as the MSA remains in effect, unless earlier terminated by mutual written agreement.

(b) **Governing Law.** This Agreement is governed by the laws of the State of Florida, without regard to its conflict of laws principles.

(c) **Entire Agreement.** This Agreement, together with the MSA, the Professional Services Terms, and any executed SOWs and order forms, constitutes the entire commercial understanding between the parties regarding pricing and payment.

(d) **Counterparts.** This Agreement may be executed in counterparts, including electronic signatures, each of which is deemed an original.

## 12. Signatures

By signing below, the parties agree to the standard commercial terms described in this Agreement.

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
