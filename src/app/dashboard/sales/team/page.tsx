/**
 * The scorecard moved out of the sales layer to its own nav page — keep old
 * links/bookmarks working.
 */
import { redirect } from "next/navigation";

export default function LegacyTeamPage() {
  redirect("/dashboard/team");
}
