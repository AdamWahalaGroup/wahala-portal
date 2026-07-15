# Architecture and security review

> Current internal-pilot assessment as of 13 July 2026. This document describes
> the implemented system and the work required before Wahala relies on it for
> sensitive client data, binding signatures, or reconciled payments.

## System shape

The portal is a Next.js App Router application deployed to Cloudflare Workers
through OpenNext. It uses:

- D1 and Drizzle for commercial, project, and audit records;
- KV for one-time login tokens and server-side sessions;
- R2 for uploaded files;
- Cloudflare Email Sending for login, invitation, and notification email;
- OpenAI APIs for configured internal AI tools;
- a separate scheduled Worker for deterministic Deal Pulse checks, bounded AI
  refreshes, and nudges.

The browser is not a security boundary. Route handlers and service functions
must authenticate, authorize, validate the requested transition, scope database
access, and record the result.

## Identity and access

Users authenticate through a one-time email link or configured Google SSO.
Magic-link and session tokens are random, stored as hashes, and delivered to the
browser in an `httpOnly`, `Secure`, `SameSite=Lax` cookie.

Wahala staff accounts are invite-only through **Team → Add member**. Google SSO
must return the exact invited primary email; a Workspace or plus-address alias is
not a second Google identity and uses the one-time email-link path instead. An
unknown address on a Wahala domain is denied rather than automatically receiving
admin access.

`src/auth/access.ts` computes one access scope per request:

| Role | Scope |
|---|---|
| Wahala admin | All organizations |
| Sales / account owner | Organizations they own |
| Lead engineer / engineer | Projects they lead or are assigned to |
| Client roles | Their own organization |

Service-layer point checks and the scoped database helper consume this scope.
Client reads also filter internal tasks, files, notes, and messages. Out-of-scope
resource requests should return not found rather than confirm another tenant's
record exists.

This is application-enforced isolation; D1 does not provide row-level security.
Any new raw database query can bypass the convention, so cross-tenant tests and
service-layer review remain mandatory.

## Commercial and delivery controls

Sales stages are editable dispositions. Delivery Phases use the guarded state
machine in `src/domain/stage-machine.ts` and the mutation path in
`src/services/stages.ts`.

The hard delivery invariant is that work cannot enter `in_progress` without the
required payment state. Status transitions use compare-and-swap updates so two
concurrent requests cannot both move the same Phase from the same prior state.

Successful transitions then write an audit event. D1 does not provide the
interactive transaction used here to make the compare-and-swap and audit insert
one indivisible operation, so an audit-write failure is logged after the state
change. That is an explicit durability gap, not an atomic audit guarantee.

Payment is currently a manual administrative record. It is not confirmation
from a payment processor or bank. Contract acceptance in the portal is also not
yet Wahala's authoritative e-signature record. The UI must not imply otherwise.

## Public and integration boundaries

Sent proposals may be viewed and answered through an unguessable bearer-token
link. Possession of that URL is the credential. Treat proposal URLs as sensitive
and add revocation/expiry and rate limiting before broad external use.

Google and Zoom integrations are optional. Provider credentials are secrets;
provider responses are external input and must not override tenant or deal
linkage without validation. Webhook verification and idempotency must be tested
for each event type before depending on automated state changes.

## AI boundary

AI is an internal drafting and analysis tool. It may read grounded records and
write suggestions or drafts. It may not contact a client, set price, change a
commercial stage, approve scope, sign an agreement, or mark payment without a
human action through an authorized server path.

Transcripts, uploads, websites, and client-authored text are untrusted model
input. Prompts must distinguish instructions from evidence. Before sending
legal-sector or other high-risk data to a model provider, Wahala needs a written
policy for client consent, allowed data classes, retention, deletion, provider
terms, and incident response.

## Highest-priority risks

Resolve these before real client data or money becomes dependent on the portal:

1. **IP and authority to sell.** The CRM can record an IP disposition; it cannot
   establish that Wahala owns or may license the code. Obtain appropriate legal
   review and evidence for each product/fork transaction.
2. **Authoritative payment confirmation.** Replace or tightly restrict manual
   marks with a signed, idempotent provider integration and reconciliation.
3. **Binding signatures.** Integrate the chosen e-signature provider and store
   provider identifiers, status, final documents, and audit evidence.
4. **Audit durability.** Make critical commercial transitions and audit evidence
   recoverable when the audit insert fails; alert rather than only logging.
5. **Tenant isolation coverage.** Inventory raw `getDb()` usage and add automated
   cross-tenant tests for every ID-addressable service and public endpoint.
6. **Rate limiting and abuse controls.** Protect authentication, public proposal,
   upload, webhook, and high-cost AI endpoints.
7. **Browser hardening.** Add and test Content-Security-Policy, HSTS,
   anti-framing, content-type, and referrer headers.
8. **Operational recovery.** Establish D1/R2 backup and export procedures,
   error alerts, credential rotation, and a tested incident-response path.

## Important follow-up controls

- Add admin MFA or stronger assurance before the portal controls real money.
- Add absolute session lifetimes and a way to revoke all sessions for a user.
- Persist and alert on denied access patterns; Worker logs alone are not a SIEM.
- Review public proposal token expiry, rotation, and replay behavior.
- Define file-size, file-type, malware-scanning, and retention controls.
- Calibrate approval thresholds and separation of duties with actual deal data.
- Run a structured security review before the first external client portal opens.

## Code map

| Concern | File(s) |
|---|---|
| Authentication and sessions | `src/auth/magic-link.ts`, `src/auth/session.ts`, `src/auth/context.ts` |
| Access scope | `src/auth/access.ts`, `src/db/scoped.ts` |
| Role/action policy | `src/auth/policy.ts` |
| Delivery state machine | `src/domain/stage-machine.ts` |
| Delivery mutations and CAS | `src/services/stages.ts` |
| Security event logging | `src/lib/security-log.ts` |
| Audit event construction | `src/services/audit.ts` |
| File visibility | `src/services/files.ts` |
| Public proposals | `src/services/proposals.ts`, `src/app/api/p/**` |
| AI boundary | `src/services/ai/**`, `src/services/pulse.ts` |

## Verification baseline

For changes affecting these controls, run the normal suite plus focused negative
tests for cross-tenant access, forbidden roles, illegal transitions, duplicate
requests, hidden internal data, and invalid public tokens:

```sh
npx tsc --noEmit
npm test
npm run lint
npx opennextjs-cloudflare build
```
