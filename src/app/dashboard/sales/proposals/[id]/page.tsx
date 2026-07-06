/**
 * Proposals moved to a dedicated full page (/dashboard/proposals/[id]) — this
 * route redirects there so old links (nudge digests, bookmarks) keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProposalDrawerRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/proposals/${id}`);
}
