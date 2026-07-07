/** Old stage URL → the renamed phase route (see ../page.tsx). */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StageRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/phases/${id}/accept`);
}
