/**
 * Enforces the tenant-isolation chokepoint: routes (src/app) and UI (src/components)
 * must NOT call the raw `getDb()` — they go through `scopedDb(ctx)` or a service so
 * scoping is always applied. This guard fails CI if a future change reaches around it.
 * (Pre-tenant auth flows under src/app/api/auth are exempt — they resolve identity.)
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url)); // src/db/ → project root

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

describe("DB access chokepoint", () => {
  it("routes/components do not import getDb (use scopedDb or a service)", () => {
    const dirs = ["src/app", "src/components"].map((d) => join(ROOT, d));
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (file.includes(join("api", "auth"))) continue; // identity resolution may use getDb
        if (/\bgetDb\b/.test(readFileSync(file, "utf8"))) offenders.push(file.replace(ROOT, ""));
      }
    }
    expect(
      offenders,
      `Use scopedDb(ctx) or a service in src/services/* instead of getDb:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
