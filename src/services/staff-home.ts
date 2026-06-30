/**
 * Staff home / admin landing (design frame 17) — clients & revenue, NOT a worklist.
 * Per client: lifetime collected (accepted stages) + promised pipeline (everything
 * agreed but not yet accepted). Tenant-scoped via scopedDb.
 */
import type { AuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { listWahalaStaff } from "@/services/clients";

const PROMISED_STATUSES = new Set(["quoted", "approved", "paid", "in_progress", "delivered", "needs_revision"]);

export type ClientRevenue = {
  orgId: string;
  orgName: string;
  ownerName: string | null;
  projectCount: number;
  paidToDateCents: number; // accepted stages (lifetime collected)
  promisedCents: number; // in-flight + approved/quoted (invoiced as stages complete)
};

export type RevenueOverview = {
  clients: ClientRevenue[];
  collectedCents: number;
  promisedCents: number;
  collectedClientCount: number; // clients with any collected revenue
  activeClientCount: number; // clients with at least one project
};

export async function staffRevenueOverview(ctx: AuthContext): Promise<RevenueOverview> {
  const sdb = scopedDb(ctx);
  const [orgs, stages, projects, staff] = await Promise.all([
    sdb.listOrganizations(),
    sdb.listAllStages(),
    sdb.listProjects(),
    listWahalaStaff(ctx),
  ]);

  const ownerName = new Map(staff.map((s) => [s.id, s.name]));
  const projectCount = new Map<string, number>();
  for (const p of projects) projectCount.set(p.organizationId, (projectCount.get(p.organizationId) ?? 0) + 1);

  const paid = new Map<string, number>();
  const promised = new Map<string, number>();
  for (const s of stages) {
    if (s.status === "accepted") paid.set(s.organizationId, (paid.get(s.organizationId) ?? 0) + s.totalAmountCents);
    else if (PROMISED_STATUSES.has(s.status)) promised.set(s.organizationId, (promised.get(s.organizationId) ?? 0) + s.totalAmountCents);
  }

  const clients: ClientRevenue[] = orgs
    .map((o) => ({
      orgId: o.id,
      orgName: o.name,
      ownerName: o.accountOwnerUserId ? ownerName.get(o.accountOwnerUserId) ?? null : null,
      projectCount: projectCount.get(o.id) ?? 0,
      paidToDateCents: paid.get(o.id) ?? 0,
      promisedCents: promised.get(o.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.paidToDateCents + b.promisedCents - (a.paidToDateCents + a.promisedCents) || a.orgName.localeCompare(b.orgName),
    );

  return {
    clients,
    collectedCents: clients.reduce((n, c) => n + c.paidToDateCents, 0),
    promisedCents: clients.reduce((n, c) => n + c.promisedCents, 0),
    collectedClientCount: clients.filter((c) => c.paidToDateCents > 0).length,
    activeClientCount: clients.filter((c) => c.projectCount > 0).length,
  };
}
