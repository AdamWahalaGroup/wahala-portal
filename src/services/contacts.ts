/**
 * Contacts — the shared person record. A lead qualifies into a contact; deals reference
 * it via primaryContactId. Editing the contact (e.g. adding an email that was missing at
 * capture) updates every surface that reads it — no need to move a card backwards to fix
 * a field (design frame 29, Contact block).
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager } from "@/services/sales";

export async function updateContact(
  ctx: AuthContext,
  contactId: string,
  input: { name?: string; email?: string; phone?: string; title?: string },
): Promise<void> {
  assertSalesManager(ctx, "update_contact");
  const db = getDb();
  const existing = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
  if (!existing) throw new StageError("NOT_FOUND", "Contact not found.");

  const patch: Partial<typeof schema.contacts.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new StageError("VALIDATION", "Contact name cannot be empty.");
    patch.name = name;
  }
  if (input.email !== undefined) patch.email = input.email.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.title !== undefined) patch.title = input.title.trim() || null;
  if (Object.keys(patch).length === 0) return;

  await db.update(schema.contacts).set(patch).where(eq(schema.contacts.id, contactId));
}
