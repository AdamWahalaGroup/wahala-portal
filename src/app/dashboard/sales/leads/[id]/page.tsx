/**
 * Legacy route — leads folded into contacts (docs/OPERATING-MODEL.md). Unqualified leads
 * kept their ids through the migration, so a straight redirect works.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/contacts/${id}`);
}
