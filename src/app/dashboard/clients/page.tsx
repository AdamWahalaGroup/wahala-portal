/**
 * Legacy route — "Clients" became "Accounts" (CRM-RESTRUCTURE.md: client is a state
 * on an account, not a thing). Old links keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ClientsRedirect() {
  redirect("/dashboard/accounts");
}
