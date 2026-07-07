import { describe, it, expect } from "vitest";
import {
  defaultComplexity,
  mkPhases,
  buildOptionShapes,
  fallbackExecSummary,
  chooseContractSourceOption,
  nextOptionLabel,
  canAmendPhase,
  buildContractPhases,
  contractDefaults,
  phaseSignature,
  mergeContractPhases,
  paymentSchedule,
} from "./proposal-math";
import type { ProposalPhase } from "./proposal-doc";

const ph = (name: string, amountCents: number, status: ProposalPhase["status"] = "awaiting_amendment", weeks = 4): ProposalPhase => ({
  name,
  amountCents,
  weeks,
  status,
});

describe("defaultComplexity", () => {
  it("maps deal size to 1–5", () => {
    expect(defaultComplexity(950_000)).toBe(1); // $9.5k
    expect(defaultComplexity(3_500_000)).toBe(2); // $35k
    expect(defaultComplexity(10_000_000)).toBe(3); // $100k
    expect(defaultComplexity(18_000_000)).toBe(5); // $180k
    expect(defaultComplexity(22_500_000)).toBe(5); // $225k
  });
});

describe("mkPhases", () => {
  it("sums to the total with the remainder on the last phase, $500 grain", () => {
    const phases = mkPhases(18_000_000, 2); // $180k
    expect(phases.map((p) => p.amountCents).reduce((a, b) => a + b)).toBe(18_000_000);
    expect(phases[0].amountCents % 50_000).toBe(0);
    expect(phases.every((p) => p.status === "awaiting_amendment")).toBe(true);
  });
  it("handles odd splits", () => {
    const phases = mkPhases(1_000_000, 3); // $10k / 3
    expect(phases).toHaveLength(3);
    expect(phases.map((p) => p.amountCents).reduce((a, b) => a + b)).toBe(1_000_000);
  });
  it("weeks floor is 2", () => {
    expect(mkPhases(200_000, 2).every((p) => p.weeks === 2)).toBe(true);
  });
});

describe("buildOptionShapes", () => {
  it("path 1 = one phased recommended-scope option, nothing marked recommended", () => {
    const s = buildOptionShapes("1", 18_000_000);
    expect(s).toHaveLength(1);
    expect(s[0].phases).toHaveLength(2);
    expect(s[0].recommended).toBe(false);
  });
  it("path 2 = lump A + phased B at the same price", () => {
    const s = buildOptionShapes("2", 18_000_000);
    expect(s.map((o) => o.label)).toEqual(["A", "B"]);
    expect(s[0].phases).toBeNull();
    expect(s[1].phases).toHaveLength(2);
    expect(s[0].priceCents).toBe(18_000_000);
    expect(s[1].priceCents).toBe(18_000_000);
  });
  it("path 3 = good/better/best with 1.3x and 1.7x on the $500 grain", () => {
    const s = buildOptionShapes("3", 18_000_000);
    expect(s.map((o) => o.priceCents)).toEqual([18_000_000, 23_400_000, 30_600_000]);
    expect(s[2].phases).toHaveLength(3);
    expect(s.every((o) => !o.recommended)).toBe(true);
  });
});

describe("fallbackExecSummary", () => {
  it("composes discovery note + shape note + lowercased weighting note without trailing period", () => {
    const out = fallbackExecSummary({ discoveryNote: "Bob wants tablets dockside.", dealName: "x", pathCount: "2", note: "They fear vendor lock-in." });
    expect(out).toContain("Bob wants tablets dockside.");
    expect(out).toContain("Two paths below");
    expect(out).toContain("Weighing they fear vendor lock-in in how this is laid out.");
  });
  it("falls back to the deal name when no discovery note", () => {
    const out = fallbackExecSummary({ discoveryNote: null, dealName: "Vega rebuild", pathCount: "1" });
    expect(out).toContain("Vega rebuild — recommended approach");
    expect(out).toContain("one recommended path");
  });
});

describe("chooseContractSourceOption / nextOptionLabel", () => {
  const opts = [
    { id: "o1", name: "A", priceCents: 1, recommended: false, phases: null },
    { id: "o2", name: "B", priceCents: 2, recommended: true, phases: null },
  ];
  it("selected wins, then recommended, then first", () => {
    expect(chooseContractSourceOption(opts, "o1")?.id).toBe("o1");
    expect(chooseContractSourceOption(opts, null)?.id).toBe("o2");
    expect(chooseContractSourceOption([opts[0]], null)?.id).toBe("o1");
  });
  it("labels advance A–H then null", () => {
    expect(nextOptionLabel(["A", "B"])).toBe("C");
    expect(nextOptionLabel(["A", "B", "C", "D", "E", "F", "G", "H"])).toBeNull();
  });
});

describe("canAmendPhase", () => {
  it("never phase 0; requires awaiting target and active/done predecessor", () => {
    const phases = [ph("P1", 1, "active"), ph("P2", 1), ph("P3", 1)];
    expect(canAmendPhase(phases, 0)).toBe(false);
    expect(canAmendPhase(phases, 1)).toBe(true); // prev active
    expect(canAmendPhase(phases, 2)).toBe(false); // prev awaiting
    const done = [ph("P1", 1, "done"), ph("P2", 1, "active"), ph("P3", 1)];
    expect(canAmendPhase(done, 2)).toBe(true); // prev active
    expect(canAmendPhase(done, 1)).toBe(false); // target not awaiting
  });
});

describe("contract snapshot", () => {
  const option = {
    id: "optB",
    name: "Phased buildout",
    priceCents: 22_500_000,
    recommended: true,
    phases: [ph("Private beta", 6_500_000, "active", 8), ph("Legal workflows", 9_500_000, "awaiting_amendment", 12), ph("Commercial readiness", 6_500_000, "awaiting_amendment", 8)],
  };

  it("payment schedule reproduces the Talden numbers", () => {
    const c = contractDefaults({ dealId: "deal_x", complexityScore: 2, option, approvers: [{ name: "Bob Ross", role: "Owner" }], generatedAt: "2026-07-07T00:00:00Z" });
    const sched = paymentSchedule(c);
    expect(sched.totalCents).toBe(22_500_000); // $225,000
    expect(sched.depositCents).toBe(2_250_000); // $22,500
    expect(sched.rows.map((r) => r.amountCents)).toEqual([2_250_000, 4_250_000, 9_500_000, 6_500_000]); // 22.5k / 42.5k / 95k / 65k
    expect(sched.rows[1].label).toBe("Phase 1 Acceptance — Private beta");
  });

  it("defaults: deposit 10%, review 5d, out-of-scope/change-mgmt track complexity>3, signer from approvers", () => {
    const light = contractDefaults({ dealId: "d", complexityScore: 2, option, approvers: [{ name: "Bob Ross", role: "Owner" }], generatedAt: "t" });
    expect(light.outOfScopeEnabled).toBe(false);
    expect(light.clientSignerName).toBe("Bob Ross");
    expect(light.proposalNumber).toMatch(/^WG-2026-\d{3}$/);
    const heavy = contractDefaults({ dealId: "d", complexityScore: 4, option, approvers: null, generatedAt: "t" });
    expect(heavy.outOfScopeEnabled).toBe(true);
    expect(heavy.changeManagementEnabled).toBe(true);
  });

  it("lump-sum options snapshot as a single pseudo-phase card", () => {
    const lump = { id: "optA", name: "Standard rollout", priceCents: 15_000_000, recommended: false, phases: null };
    const phases = buildContractPhases(lump);
    expect(phases).toHaveLength(1);
    expect(phases[0].weeks).toBeNull();
    expect(phases[0].acceptanceText).toBe("Delivered scope meets agreed requirements and passes review.");
  });

  it("staleness flips on rename, amount, or weeks", () => {
    const sig = phaseSignature(buildContractPhases(option));
    const renamed = { ...option, phases: option.phases.map((p, i) => (i === 0 ? { ...p, name: "Beta" } : p)) };
    const repriced = { ...option, phases: option.phases.map((p, i) => (i === 1 ? { ...p, amountCents: 1 } : p)) };
    expect(phaseSignature(buildContractPhases(renamed))).not.toBe(sig);
    expect(phaseSignature(buildContractPhases(repriced))).not.toBe(sig);
    expect(phaseSignature(buildContractPhases(option))).toBe(sig);
  });

  it("resync preserves written text for name-matched phases, boilerplate for new ones", () => {
    const c = contractDefaults({ dealId: "d", complexityScore: 2, option, approvers: null, generatedAt: "t" });
    const edited = c.phases.map((p, i) => (i === 0 ? { ...p, objective: "HAND-WRITTEN OBJECTIVE" } : p));
    const changed = {
      ...option,
      phases: [option.phases[0], { ...option.phases[1], name: "Renamed workflows" }, option.phases[2]],
    };
    const merged = mergeContractPhases(edited, changed);
    expect(merged[0].objective).toBe("HAND-WRITTEN OBJECTIVE"); // survived
    expect(merged[1].objective).toBe("Deliver Renamed workflows as scoped in this engagement."); // boilerplate
    expect(merged[2].objective).toBe(edited[2].objective);
  });
});
