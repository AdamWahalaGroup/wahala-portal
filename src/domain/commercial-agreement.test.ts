import { describe, expect, it } from "vitest";
import { commercialAgreementMarkdown, COMMERCIAL_AGREEMENT_TEMPLATE_VERSION } from "./commercial-agreement";

describe("commercialAgreementMarkdown", () => {
  it("merges the counterparty, effective date, and MSA date", () => {
    const md = commercialAgreementMarkdown({
      counterpartyName: "Harbor Point Marina",
      effectiveDate: "July 10, 2026",
      msaDate: "July 1, 2026",
    });
    expect(md).toContain('**Harbor Point Marina** ("Client")');
    expect(md).toContain("**July 10, 2026**");
    expect(md).toContain("dated **July 1, 2026**");
  });

  it("blanks the MSA date when none is on file", () => {
    const md = commercialAgreementMarkdown({ counterpartyName: "Acme", effectiveDate: "d" });
    expect(md).toContain("dated **____________________**");
  });

  it("keeps the load-bearing commercial terms verbatim from the v1.0 source doc", () => {
    const md = commercialAgreementMarkdown({ counterpartyName: "X", effectiveDate: "d" });
    expect(COMMERCIAL_AGREEMENT_TEMPLATE_VERSION).toBe("1.0");
    for (const anchor of [
      "deposit of ten percent (10%) of the total SOW fee",
      "credited against the payment due at the first phase or milestone acceptance",
      "actual cost plus a fifteen percent (15%) handling fee",
      "cost exceeding [$5,000]",
      "sixty (60) days' written notice",
      "Net 30",
      "one and one-half percent (1.5%) per month",
      "disputed charge within thirty (30) days",
      "do not change the pricing of any SOW or order form already in effect",
      "laws of the State of Florida",
    ]) {
      expect(md).toContain(anchor);
    }
  });

  it("keeps the placeholder rate-card warning until real rates land", () => {
    const md = commercialAgreementMarkdown({ counterpartyName: "X", effectiveDate: "d" });
    expect(md).toContain("[$220] / hour");
    expect(md).toContain("illustrative placeholders");
  });
});
