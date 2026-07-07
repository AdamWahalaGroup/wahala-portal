/**
 * Proposals are a FIRST-CLASS nav destination at /dashboard/proposals
 * (HANDOFF-DELTA-2026-07-07 §2). Path deviation from the prototype: its
 * /dashboard/sales/proposals would render inside the sales layout (board +
 * drawer), contradicting "first-class nav item" — so the full pages live
 * outside the sales segment and this route redirects for old links.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProposalsIndexRedirect() {
  redirect("/dashboard/proposals");
}
