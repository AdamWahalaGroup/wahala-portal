/**
 * The Proposals index is absorbed into the board (frame 29): the "Proposals out"
 * filter chip lenses the board to deals with a live proposal. This route redirects
 * there so old links keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProposalsIndexRedirect() {
  redirect("/dashboard/sales?filter=proposals_out");
}
