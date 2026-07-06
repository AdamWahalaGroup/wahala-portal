import { describe, it, expect } from "vitest";
import { vttToTranscript, verifyZoomSignature, hmacHex } from "./zoom";

describe("vttToTranscript", () => {
  it("strips headers/cue numbers/timestamps and keeps speaker lines", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:04.000",
      "Jason Milton: Morning, Bob. Appreciate you taking the time.",
      "",
      "2",
      "00:00:04.500 --> 00:00:06.000",
      "Jason Milton: Before we get into ideas or technology.",
      "",
      "3",
      "00:00:06.500 --> 00:00:09.000",
      "Bob Ross: I appreciate that.",
    ].join("\n");
    expect(vttToTranscript(vtt)).toBe(
      [
        "Jason Milton: Morning, Bob. Appreciate you taking the time. Before we get into ideas or technology.",
        "Bob Ross: I appreciate that.",
      ].join("\n"),
    );
  });

  it("keeps un-attributed cue text and survives CRLF", () => {
    const vtt = "WEBVTT\r\n\r\n1\r\n00:00:01.000 --> 00:00:02.000\r\n(recording started)\r\n";
    expect(vttToTranscript(vtt)).toBe("(recording started)");
  });

  it("returns empty for an empty/only-header file", () => {
    expect(vttToTranscript("WEBVTT\n\n")).toBe("");
  });
});

describe("verifyZoomSignature", () => {
  it("accepts the v0 HMAC of v0:{ts}:{body} and rejects everything else", async () => {
    const secret = "shhh";
    const ts = "1717171717";
    const body = '{"event":"recording.transcript_completed"}';
    const mac = await hmacHex(secret, `v0:${ts}:${body}`);
    expect(await verifyZoomSignature(`v0=${mac}`, ts, body, secret)).toBe(true);
    expect(await verifyZoomSignature(`v0=${mac}`, ts, body + " ", secret)).toBe(false);
    expect(await verifyZoomSignature(`v0=deadbeef`, ts, body, secret)).toBe(false);
    expect(await verifyZoomSignature(null, ts, body, secret)).toBe(false);
    expect(await verifyZoomSignature(`v0=${mac}`, null, body, secret)).toBe(false);
    expect(await verifyZoomSignature(`v0=${mac}`, ts, body, "")).toBe(false);
  });
});
