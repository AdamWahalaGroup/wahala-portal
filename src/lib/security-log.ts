/**
 * Structured security logging for denied/cross-tenant attempts.
 *
 * Writes to the Worker log (captured by Cloudflare observability) — NEVER to a
 * response. Use it wherever we refuse access so probing/abuse leaves a trail
 * (the audit log only records successful changes).
 */
export type SecurityEvent = {
  actorUserId?: string | null;
  role?: string;
  action: string; // what they tried, e.g. "load_stage", "stage.deliver", "create_project"
  resource?: string; // e.g. "stage:<id>", "org:<id>"
  reason: string; // why it was denied
};

export function securityLog(event: SecurityEvent): void {
  console.warn(`[security] ${JSON.stringify(event)}`);
}
