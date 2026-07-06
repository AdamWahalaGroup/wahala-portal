/**
 * Root — straight into the app. /dashboard renders for a signed-in user (or the
 * demo viewer on the demo deployment) and auth-redirects everyone else to /login.
 * The old Phase-0 landing copy is gone; the dashboard is the front door now.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/dashboard");
}
