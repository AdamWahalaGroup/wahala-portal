import { describe, expect, it } from "vitest";
import { msaMarkdown, MSA_TEMPLATE_VERSION } from "./msa";

describe("msaMarkdown", () => {
  it("merges the client name and effective date into the preamble and signature block", () => {
    const md = msaMarkdown({ clientName: "Harbor Point Marina", effectiveDate: "July 10, 2026" });
    expect(md).toContain('**Harbor Point Marina** ("Client")');
    expect(md).toContain("**July 10, 2026**");
    expect(md).toContain("**Client — Harbor Point Marina**");
  });

  it("fills known signers and blanks the rest", () => {
    const md = msaMarkdown({
      clientName: "Acme",
      effectiveDate: "July 10, 2026",
      wahalaRepName: "Adam Nichols",
      clientRepName: "Bob Ross",
      clientRepTitle: "Owner",
    });
    expect(md).toContain("Authorized Representative: Adam Nichols");
    expect(md).toContain("Authorized Representative: Bob Ross");
    expect(md).toContain("Title: Owner");
    expect(md).toContain("Title: ____________________"); // Wahala title unknown → blank line
  });

  it("keeps the load-bearing legal sections verbatim from the v1.0 source doc", () => {
    const md = msaMarkdown({ clientName: "X", effectiveDate: "d" });
    expect(MSA_TEMPLATE_VERSION).toBe("1.0");
    for (const anchor of [
      "order of precedence",
      "No work shall begin until an authorized Statement of Work has been executed",
      "Invoices are due within thirty (30) days.",
      "shall require an executed Change Order before the additional work begins",
      "ten (10) business days following delivery",
      "aggregate liability under this Agreement shall not exceed the total fees paid",
      "thirty (30) days written notice",
      "twelve (12) months thereafter",
      "laws of the State of Florida",
      "Brevard County, Florida",
    ]) {
      expect(md).toContain(anchor);
    }
  });

  it("falls back to a placeholder when the client name is empty", () => {
    expect(msaMarkdown({ clientName: "  ", effectiveDate: "d" })).toContain('**Client Name** ("Client")');
  });
});
