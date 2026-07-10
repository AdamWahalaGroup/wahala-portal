import { describe, expect, it } from "vitest";
import { psTermsMarkdown, PS_TERMS_TEMPLATE_VERSION } from "./ps-terms";

describe("psTermsMarkdown", () => {
  it("merges the counterparty, effective date, and MSA date", () => {
    const md = psTermsMarkdown({
      counterpartyName: "Harbor Point Marina",
      effectiveDate: "July 10, 2026",
      msaDate: "July 1, 2026",
    });
    expect(md).toContain('**Harbor Point Marina** ("Client")');
    expect(md).toContain("**July 10, 2026**");
    expect(md).toContain("dated **July 1, 2026**");
  });

  it("blanks the MSA date when none is on file", () => {
    const md = psTermsMarkdown({ counterpartyName: "Acme", effectiveDate: "d" });
    expect(md).toContain("dated **____________________**");
  });

  it("keeps the load-bearing delivery terms verbatim from the v1.0 source doc", () => {
    const md = psTermsMarkdown({ counterpartyName: "X", effectiveDate: "d" });
    expect(PS_TERMS_TEMPLATE_VERSION).toBe("1.0");
    for (const anchor of [
      "order of precedence applies, from highest to lowest",
      "silence in a SOW means these Terms apply",
      "five (5) business days of delivery",
      "deemed accepted and any associated milestone payment becomes due",
      "review period restarts for the corrected deliverable only",
      "no work outside the scope of the applicable SOW will begin until the corresponding Change Order is executed",
      "Ongoing operational support, maintenance, hosting, or monitoring",
      "SOC 2, HIPAA, PCI-DSS",
      "sixty (60) days following Client's acceptance of a deliverable",
      "Background IP",
      "owned by Client upon full payment",
      "payment is more than fifteen (15) days overdue",
      "laws of the State of Florida",
    ]) {
      expect(md).toContain(anchor);
    }
  });
});
