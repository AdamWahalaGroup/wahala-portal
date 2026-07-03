/**
 * Legacy route — the client hub became the Account page (frame 33). Same org ids.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClientHubRedirect({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/dashboard/accounts/${orgId}`);
}
