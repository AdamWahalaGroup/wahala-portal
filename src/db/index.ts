import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { StageError } from "@/domain/stage-machine";
import { isDemoMode } from "@/auth/demo";
import * as schema from "./schema";

// Demo deployment is a VIEWER, not a sandbox: block every write entry point at
// the one DB chokepoint. Reads (select / query.*) pass through untouched.
const WRITE_METHODS = new Set(["insert", "update", "delete", "batch", "run", "transaction"]);

function readOnly<T extends object>(db: T): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && WRITE_METHODS.has(prop)) {
        throw new StageError("FORBIDDEN", "This is the read-only design-review demo — changes are disabled.");
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Returns a Drizzle client bound to the request's Cloudflare D1 database.
 * Call inside a request (route handler / server action), not at module top level.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB, { schema });
  return isDemoMode() ? readOnly(db) : db;
}

export { schema };
