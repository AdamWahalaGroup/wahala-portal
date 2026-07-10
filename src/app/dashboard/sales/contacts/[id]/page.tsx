/**
 * The drawer-over-board contact workspace merged into the durable contact page
 * (10 Jul) — the dump + scout report render there now. Old links keep working.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ContactWorkspaceRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/contacts/${id}`);
}
