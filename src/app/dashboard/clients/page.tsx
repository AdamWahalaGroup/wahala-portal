/**
 * Legacy route — "Clients" became "Accounts" (docs/OPERATING-MODEL.md: client is a state
 * on an account, not a thing). Old links keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ClientsRedirect() {
  redirect("/dashboard/accounts");
}
