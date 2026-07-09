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
  input: { name?: string; email?: string; phone?: string; title?: string; source?: string },
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
  if (input.source !== undefined) patch.source = input.source.trim() || null;
  if (Object.keys(patch).length === 0) return;

  await db.update(schema.contacts).set(patch).where(eq(schema.contacts.id, contactId));
}

/**
 * Attach the contact to an account (or detach with null) — "attaching links both
 * ways": current account on the contact row + a contact_companies link so the
 * Account page's people union sees it. Admin / account owner.
 */
export async function attachContactToOrganization(ctx: AuthContext, contactId: string, organizationId: string | null): Promise<void> {
  assertSalesManager(ctx, "attach_contact_to_org");
  const db = getDb();
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
  if (!contact) throw new StageError("NOT_FOUND", "Contact not found.");

  if (organizationId === null) {
    await db.update(schema.contacts).set({ organizationId: null }).where(eq(schema.contacts.id, contactId));
    return;
  }

  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
  if (!org) throw new StageError("NOT_FOUND", "Account not found.");

  await db.update(schema.contacts).set({ organizationId }).where(eq(schema.contacts.id, contactId));
  const links = await db.select().from(schema.contactCompanies).where(eq(schema.contactCompanies.contactId, contactId));
  const existing = links.find((l) => l.organizationId === organizationId);
  if (existing) {
    if (!existing.current) await db.update(schema.contactCompanies).set({ current: true }).where(eq(schema.contactCompanies.id, existing.id));
  } else {
    await db.insert(schema.contactCompanies).values({
      id: crypto.randomUUID(),
      contactId,
      organizationId,
      title: contact.title,
      isPrimary: links.length === 0,
      current: true,
    });
  }
}
