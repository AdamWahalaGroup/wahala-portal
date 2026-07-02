/**
 * The Leads list is absorbed into the board (frame 29): the Triage column IS the lead
 * list, reachable via the "To qualify" filter chip. This route redirects there so old
 * links keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LeadsIndexRedirect() {
  redirect("/dashboard/sales?filter=to_qualify");
}
