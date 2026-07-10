import { describe, expect, it } from "vitest";
import { derivedProjectStatus } from "./project-status";

describe("derivedProjectStatus", () => {
  it("no phases → setting up", () => {
    expect(derivedProjectStatus([])).toEqual({ label: "setting up", tone: "setup" });
  });
  it("all accepted → complete", () => {
    expect(derivedProjectStatus(["accepted", "accepted"])).toEqual({ label: "complete", tone: "complete" });
  });
  it("any working phase → active (even with accepted siblings)", () => {
    expect(derivedProjectStatus(["accepted", "in_progress"]).label).toBe("active");
    expect(derivedProjectStatus(["paid"]).label).toBe("active");
    expect(derivedProjectStatus(["delivered", "draft"]).label).toBe("active");
    expect(derivedProjectStatus(["needs_revision"]).label).toBe("active");
  });
  it("only pre-money phases → quoting", () => {
    expect(derivedProjectStatus(["draft"]).label).toBe("quoting");
    expect(derivedProjectStatus(["quoted", "approved"]).label).toBe("quoting");
    expect(derivedProjectStatus(["accepted", "draft"]).label).toBe("quoting");
  });
});
