/**
 * Stage detail — the lifecycle screen. Shows status, money, line items, the
 * actions THIS user may take now (server-computed), and the audit timeline.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getStageDetail } from "@/services/stages";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { StatusBadge } from "@/components/StatusBadge";
import { StageActions } from "@/components/StageActions";
import { formatCents, ACTION_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

const wrap: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 24px",
  lineHeight: 1.5,
};

function auditLabel(action: string): string {
  const key = action.replace(/^stage\./, "");
  return ACTION_LABELS[key] ?? key.replace(/_/g, " ");
}

export default async function StagePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const detail = await getStageDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { stage, lineItems, audit, actions } = detail;

  return (
    <main style={wrap}>
      <Link href={`/dashboard/projects/${stage.projectId}`} style={{ fontSize: 14 }}>
        ← Project
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 2px" }}>
        <h1 style={{ margin: 0 }}>{stage.name}</h1>
        <StatusBadge status={stage.status} />
      </div>
      <p style={{ margin: 0, fontSize: 18, color: "#111" }}>{formatCents(stage.totalAmountCents)}</p>
      {stage.requiresAdminApproval && (
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#b45309" }}>
          ⚑ Over the approval threshold — requires a Wahala admin co-sign.
        </p>
      )}
      {stage.scopeDescription && <p style={{ color: "#444" }}>{stage.scopeDescription}</p>}

      {/* Lifecycle actions */}
      <section style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Actions</h2>
        <StageActions stageId={stage.id} actions={actions} />
      </section>

      {/* Line items */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>
          Line items <span style={{ color: "#999", fontWeight: 400 }}>({lineItems.length})</span>
        </h2>
        {lineItems.length === 0 ? (
          <p style={{ color: "#888" }}>No line items.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {lineItems.map((li) => (
              <li key={li.id} style={{ marginBottom: 4 }}>
                {li.description}
                {li.estimateNote ? <span style={{ color: "#888", fontSize: 13 }}> · {li.estimateNote}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit timeline */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>History</h2>
        {audit.length === 0 ? (
          <p style={{ color: "#888" }}>No history yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {audit.map((a, i) => (
              <li key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #f2f2f2", fontSize: 14 }}>
                <span style={{ minWidth: 130, fontWeight: 600 }}>{auditLabel(a.action)}</span>
                <span style={{ color: "#666" }}>
                  {a.from && a.to ? <span style={{ color: "#999" }}>{a.from} → {a.to} · </span> : null}
                  by {a.actorName} · {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
