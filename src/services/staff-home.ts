/**
 * Staff home / admin landing (design frame 17) — clients & revenue, NOT a worklist.
 * Money is bucketed by the PAYMENT fact (stages.paidAt), not the work status, so the
 * split is correct under either billing model: "pay before work" (paidAt set at the
 * paid step) or a future "pay on completion" (paidAt set at acceptance). Per client:
 *   - paidToDate = stages with paidAt set (money actually received),
 *   - promised   = stages agreed but not yet paid (outstanding).
 * Tenant-scoped via scopedDb.
 */
import type { AuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { listWahalaStaff } from "@/services/clients";

export type ClientRevenue = {
  orgId: string;
  orgName: string;
  ownerName: string | null;
  projectCount: number;
  paidToDateCents: number; // stages actually paid (paidAt set) — money received
  promisedCents: number; // agreed but not yet paid — outstanding, regardless of billing model
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
    if (s.paidAt) {
      // Money in the door — regardless of where the stage is in its work lifecycle.
      paid.set(s.organizationId, (paid.get(s.organizationId) ?? 0) + s.totalAmountCents);
    } else if (s.status !== "draft" && s.status !== "rejected") {
      // Agreed (or in flight) but not yet collected — outstanding.
      promised.set(s.organizationId, (promised.get(s.organizationId) ?? 0) + s.totalAmountCents);
    }
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
