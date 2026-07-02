/**
 * Context-free email primitive — the ONE place that talks to the Cloudflare EMAIL
 * binding. Deliberately imports nothing from @opennextjs/cloudflare so it can be
 * bundled by the standalone cron Worker (which has no request context). Callers pass
 * `env` — from `getCloudflareContext().env` in a request, or the `env` argument in a
 * scheduled handler.
 *
 * NOTE: the binding's object form (`send({ to, from: { email, name }, ... })`) is
 * current per the Cloudflare Email Service docs, but the generated `SendEmail` types
 * lag it — hence the narrow cast rather than relying on the binding type.
 */
interface EmailSendable {
  send(message: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<unknown>;
}

/** Minimal env shape needed to send (works from request OR scheduled handler). */
export type EmailEnv = { EMAIL: unknown; EMAIL_FROM?: string };

export async function sendEmail(
  env: EmailEnv,
  msg: { to: string; subject: string; text?: string; html?: string },
): Promise<void> {
  const email = env.EMAIL as unknown as EmailSendable;
  await email.send({
    to: msg.to,
    from: { email: env.EMAIL_FROM ?? "login@wahala-services.com", name: "Wahala Portal" },
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}
