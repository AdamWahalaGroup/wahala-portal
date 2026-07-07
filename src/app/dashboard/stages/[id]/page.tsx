/**
 * Phases were renamed (06 Jul vocabulary: Phase = delivery unit, Stage = deal
 * pipeline) — old stage URLs in emails/notifications redirect to /dashboard/phases.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StageRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/phases/${id}`);
}
