/**
 * Audit trail helper — accountability is the product (PLAN.md §4, §9).
 *
 * Returns the row values for an `audit_log` insert so callers can include it in
 * the same `db.batch([...])` as the state change, keeping "what happened" and
 * "we recorded it" atomic.
 */
import { schema } from "@/db";

export type AuditInput = {
  organizationId: string;
  actorUserId: string | null;
  action: string; // e.g. "stage.paid", "stage.accepted"
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
};

export function buildAudit(input: AuditInput): typeof schema.auditLog.$inferInsert {
  return {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  };
}
