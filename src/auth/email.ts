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
import { sendEmail, type EmailEnv } from "@/auth/send-email";

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { env } = getCloudflareContext();
  await sendEmail(env as unknown as EmailEnv, {
    to,
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
  await sendEmail(env as unknown as EmailEnv, {
    to,
    subject: "You're invited to Wahala Portal",
    text: `You've been invited to the ${orgName} client portal on Wahala Portal.\n\nAccept your invitation and sign in:\n${url}\n\nThis link expires in 15 minutes. If you weren't expecting this, you can ignore it.`,
    html: `<p>You've been invited to the <strong>${orgName}</strong> client portal on <strong>Wahala Portal</strong>.</p>
<p><a href="${url}">Accept your invitation &amp; sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 15 minutes. If you weren't expecting this, you can ignore it.</p>`,
  });
}

/** Staff invitation — accepts the app account through the existing magic-link flow. */
export async function sendStaffInviteEmail(to: string, url: string, roleLabel: string): Promise<void> {
  const { env } = getCloudflareContext();
  await sendEmail(env as unknown as EmailEnv, {
    to,
    subject: "You're invited to the Wahala team portal",
    text: `You've been invited to Wahala Portal as ${roleLabel}.\n\nAccept your invitation and sign in:\n${url}\n\nThis link expires in 15 minutes. After it expires, request a new one-time link from the login page using this exact email address. If this is an email alias, use the email link rather than Google SSO.`,
    html: `<p>You've been invited to <strong>Wahala Portal</strong> as <strong>${roleLabel}</strong>.</p>
<p><a href="${url}">Accept your invitation &amp; sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 15 minutes. After it expires, request a new one-time link from the login page using this exact email address. If this is an email alias, use the email link rather than Google SSO.</p>`,
  });
}
