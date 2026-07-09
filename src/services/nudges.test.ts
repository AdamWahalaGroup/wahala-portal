import { describe, it, expect } from "vitest";
import { selectStuckDeals, selectFollowupProposals, selectOverdueLeads, shouldSendDigest, buildDigest, type Nudge } from "./nudges";
import { resolveSla, DEFAULT_SLA_SETTINGS } from "../domain/sla";

const NOW = new Date("2026-07-06T13:00:00Z"); // a Monday
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const sla = DEFAULT_SLA_SETTINGS; // stuck 14, triage 3, proposalFollowup 7

describe("selectStuckDeals", () => {
  const deals = [
    { id: "d1", name: "Old", stage: "discovery" as const, stageEnteredAt: daysAgo(20), ownerUserId: "u1" },
    { id: "d2", name: "Fresh", stage: "discovery" as const, stageEnteredAt: daysAgo(3), ownerUserId: "u1" },
    { id: "d3", name: "Won long ago", stage: "won" as const, stageEnteredAt: daysAgo(90), ownerUserId: "u1" },
  ];
  it("flags only open deals past the window, with owner + deep link", () => {
    const out = selectStuckDeals(deals, sla, NOW);
    expect(out.map((n) => n.entityId)).toEqual(["d1"]);
    expect(out[0].userId).toBe("u1");
    expect(out[0].kind).toBe("deal_stuck");
    expect(out[0].href).toContain("/dashboard/sales/deals/d1");
    expect(out[0].overdueDays).toBe(6); // 20 - 14
  });
  it("honours a tighter per-stage window", () => {
    const tight = resolveSla({ stuckPerStage: { discovery: 2 } });
    expect(selectStuckDeals(deals, tight, NOW).map((n) => n.entityId).sort()).toEqual(["d1", "d2"]);
  });
});

describe("selectFollowupProposals", () => {
  const base = { version: 1, dealId: "d1", dealName: "Acme", ownerUserId: "u9" };
  it("flags sent+unanswered past the window; skips fresh/answered/other-status", () => {
    const props = [
      { ...base, id: "p1", status: "sent", sentAt: daysAgo(9), respondedAt: null },
      { ...base, id: "p2", status: "sent", sentAt: daysAgo(2), respondedAt: null },
      { ...base, id: "p3", status: "sent", sentAt: daysAgo(9), respondedAt: daysAgo(1) },
      { ...base, id: "p4", status: "approved", sentAt: daysAgo(9), respondedAt: null },
    ];
    const out = selectFollowupProposals(props, sla, NOW);
    expect(out.map((n) => n.entityId)).toEqual(["p1"]);
    expect(out[0].userId).toBe("u9");
    expect(out[0].href).toContain("/dashboard/proposals/p1");
  });
});

describe("selectOverdueLeads", () => {
  it("flags stage-new opportunities older than the triage window, carrying the owner", () => {
    const deals = [
      { id: "d1", name: "Dale — opportunity", stage: "new" as const, stageEnteredAt: daysAgo(5), ownerUserId: "u2" },
      { id: "d2", name: "Fresh — opportunity", stage: "new" as const, stageEnteredAt: daysAgo(1), ownerUserId: null },
      { id: "d3", name: "Accepted", stage: "discovery" as const, stageEnteredAt: daysAgo(9), ownerUserId: "u2" },
    ];
    const out = selectOverdueLeads(deals, sla, NOW);
    expect(out.map((n) => n.entityId)).toEqual(["d1"]);
    expect(out[0].userId).toBe("u2");
    expect(out[0].entityType).toBe("deal");
    expect(out[0].href).toContain("/dashboard/sales/deals/d1");
  });
});

describe("shouldSendDigest", () => {
  it("off never sends", () => {
    expect(shouldSendDigest("off", NOW, null)).toBe(false);
  });
  it("daily sends once per day", () => {
    expect(shouldSendDigest("daily", NOW, null)).toBe(true);
    expect(shouldSendDigest("daily", NOW, "2026-07-06")).toBe(false); // already sent today
  });
  it("monday sends only on Monday", () => {
    const tuesday = new Date("2026-07-07T13:00:00Z");
    expect(shouldSendDigest("monday", NOW, null)).toBe(true); // NOW is Monday
    expect(shouldSendDigest("monday", tuesday, null)).toBe(false);
  });
});

describe("buildDigest", () => {
  it("counts items and includes only non-empty sections", () => {
    const nudges: Nudge[] = [
      { kind: "deal_stuck", entityType: "deal", entityId: "d1", userId: "u1", href: "h", title: "Deal stuck: A", body: "b", overdueDays: 1 },
      { kind: "lead_overdue", entityType: "contact", entityId: "c1", userId: "u1", href: "h", title: "Contact: B", body: "b", overdueDays: 1 },
    ];
    const { subject, text, html } = buildDigest(nudges);
    expect(subject).toContain("2 need");
    expect(text).toContain("Stuck deals (1)");
    expect(text).toContain("Contacts to triage (1)");
    expect(text).not.toContain("Proposal follow-up"); // empty section omitted
    expect(html).toContain("Stuck deals (1)");
  });
});
