import { describe, it, expect } from "vitest";
import { zoomIdFromUrl, makeIcs } from "./meetings";

describe("zoomIdFromUrl", () => {
  it("extracts the meeting id from join links (webhook keying)", () => {
    expect(zoomIdFromUrl("https://us05web.zoom.us/j/84512345678?pwd=abc")).toBe("84512345678");
    expect(zoomIdFromUrl("https://zoom.us/j/12345678")).toBe("12345678");
    expect(zoomIdFromUrl("https://meet.google.com/abc-defg-hij")).toBeNull();
    expect(zoomIdFromUrl(null)).toBeNull();
  });
});

describe("makeIcs", () => {
  it("emits a valid VEVENT with escaping and the join URL", () => {
    const ics = makeIcs({
      uid: "m1",
      title: "Kickoff; phase 1, review",
      start: new Date("2026-07-09T14:00:00Z"),
      end: new Date("2026-07-09T14:45:00Z"),
      description: "Join: https://example.com/j/1\nSee you there",
      url: "https://example.com/j/1",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:m1@portal.wahala-services.com");
    expect(ics).toContain("DTSTART:20260709T140000Z");
    expect(ics).toContain("DTEND:20260709T144500Z");
    expect(ics).toContain("SUMMARY:Kickoff\\; phase 1\\, review");
    expect(ics).toContain("DESCRIPTION:Join: https://example.com/j/1\\nSee you there");
    expect(ics).toContain("URL:https://example.com/j/1");
    expect(ics).toContain("END:VCALENDAR");
  });
});
