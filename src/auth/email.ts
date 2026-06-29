/**
 * Login email delivery via the native Cloudflare EMAIL binding (Email Sending).
 *
 * The `from` domain must be onboarded first: `wrangler email sending enable <domain>`.
 * Until then this throws and the request route falls back to surfacing the link
 * in dev. This is the ONE function to revisit once the domain is live.
 *
 * NOTE: the binding's object form (`send({ to, from: { email, name }, ... })`) is
 * current per the Cloudflare Email Service docs, but the generated `SendEmail`
 * types lag it — hence the narrow cast below rather than relying on the binding type.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { emailFrom } from "@/auth/server-env";

interface EmailSendable {
  send(message: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<unknown>;
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { env } = getCloudflareContext();
  const email = env.EMAIL as unknown as EmailSendable;
  await email.send({
    to,
    from: { email: emailFrom(), name: "Wahala Portal" },
    subject: "Your Wahala Portal sign-in link",
    text: `Sign in to Wahala Portal:\n\n${url}\n\nThis link expires in 15 minutes and can be used once. If you didn't request it, ignore this email.`,
    html: `<p>Sign in to <strong>Wahala Portal</strong>:</p>
<p><a href="${url}">Sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 15 minutes and can be used once. If you didn't request it, you can ignore this email.</p>`,
  });
}

/** Invitation email — a magic link that accepts the invite and signs the client in. */
export async function sendInviteEmail(to: string, url: string, orgName: string): Promise<void> {
  const { env } = getCloudflareContext();
  const email = env.EMAIL as unknown as EmailSendable;
  await email.send({
    to,
    from: { email: emailFrom(), name: "Wahala Portal" },
    subject: "You're invited to Wahala Portal",
    text: `You've been invited to the ${orgName} client portal on Wahala Portal.\n\nAccept your invitation and sign in:\n${url}\n\nThis link expires in 15 minutes. If you weren't expecting this, you can ignore it.`,
    html: `<p>You've been invited to the <strong>${orgName}</strong> client portal on <strong>Wahala Portal</strong>.</p>
<p><a href="${url}">Accept your invitation &amp; sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 15 minutes. If you weren't expecting this, you can ignore it.</p>`,
  });
}
