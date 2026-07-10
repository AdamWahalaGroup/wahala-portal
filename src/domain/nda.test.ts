import { describe, expect, it } from "vitest";
import { ndaMarkdown, NDA_TEMPLATE_VERSION } from "./nda";

describe("ndaMarkdown", () => {
  it("merges the counterparty name and effective date into the preamble and signature block", () => {
    const md = ndaMarkdown({ counterpartyName: "Harbor Point Marina", effectiveDate: "July 10, 2026" });
    expect(md).toContain('**Harbor Point Marina**, with its principal place of business');
    expect(md).toContain("**July 10, 2026**");
    // Signature block heading carries the merged name too.
    expect(md.split("**Harbor Point Marina**").length).toBeGreaterThan(2);
  });

  it("fills known signers and blanks the rest", () => {
    const md = ndaMarkdown({
      counterpartyName: "Acme",
      effectiveDate: "July 10, 2026",
      wahalaRepName: "Adam Nichols",
      clientRepName: "Bob Ross",
      clientRepTitle: "Owner",
    });
    expect(md).toContain("Name: Adam Nichols");
    expect(md).toContain("Name: Bob Ross");
    expect(md).toContain("Title: Owner");
    expect(md).toContain("Title: ____________________"); // Wahala title unknown → blank line
  });

  it("keeps the load-bearing legal sections verbatim from the v1.0 source doc", () => {
    const md = ndaMarkdown({ counterpartyName: "X", effectiveDate: "d" });
    expect(NDA_TEMPLATE_VERSION).toBe("1.0");
    for (const anchor of [
      "designated as confidential or that a reasonable person would understand to be confidential",
      "solely to evaluate or carry out the Purpose",
      "no case less than a reasonable degree of care",
      "prompt written notice so the Disclosing Party may seek a protective order",
      "continues for two (2) years",
      "thirty (30) days' written notice",
      "three (3) years from the date of disclosure",
      "trade secret status",
      "injunctive relief",
      "without the necessity of posting a bond",
      "the confidentiality provisions of that later agreement supersede this Agreement",
      "whichever agreement affords greater protection",
      "laws of the State of Florida",
      "No Publicity",
    ]) {
      expect(md).toContain(anchor);
    }
  });

  it("falls back to a placeholder when the counterparty name is empty", () => {
    expect(ndaMarkdown({ counterpartyName: "  ", effectiveDate: "d" })).toContain("**Counterparty Legal Name**");
  });
});
