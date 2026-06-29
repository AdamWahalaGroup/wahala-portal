# Wahala Portal — How It Works, and Where the Holes Are

> Written for two audiences: someone who wants to *understand* the system, and
> someone who wants to *poke holes* in it. It is deliberately honest about
> weaknesses — the "Known limitations" section (§7) is the most important part.
> Severity tags: 🔴 fix before real clients/money · 🟡 should fix · 🟢 minor / known trade-off.

---

## 1. TL;DR

Wahala Portal is a Next.js app running entirely on **Cloudflare** (Workers + D1
SQLite + KV + R2 + Email). The security model rests on four ideas:

1. **The server is the only authority.** The UI only ever *mirrors* what the
   server decides. Every check is re-run on the server for each request.
2. **Identity = a magic link to your email.** No passwords. Sessions are random
   tokens stored server-side in KV; the browser only holds an opaque cookie.
3. **Three guardrails on data:** *tenant isolation* (a client sees only their own
   company's data), *visibility* (clients never see internal items), and *RBAC*
   (what your role lets you do).
4. **The money rule is a state machine.** A "Stage" can't enter work until it's
   `paid`, enforced in one server-side code path, with every change written to an
   audit log in the same database transaction.

It's a clean, well-separated, tested design for an early product. The honest
risks are mostly about **hardening** (concurrency, rate limiting, scoping staff
access, replacing the manual "mark paid" with real Stripe), not about the shape
being wrong. Details below.

---

## 2. The layers (how a request flows)

```
Browser ──HTTP──▶ Cloudflare Worker (Next.js)
                    │
   1. AUTH      getAuthContext(): cookie → KV session → load user  (who are you?)
   2. AUTHZ     policy + scoped queries                            (may you?)
   3. DOMAIN    stage state machine + pay-gate                     (is this legal?)
   4. DATA      Drizzle → D1 (SQLite), atomic write + audit log    (record it)
```

Concrete walkthrough — **a client approves a quote**:

1. Their browser sends the request with the session cookie.
2. `getAuthContext()` reads the cookie, looks the session up in KV, loads the
   user from the database. No valid session → 401.
3. The stage service loads the stage **scoped to the user's org** — if the stage
   belongs to another company it returns "not found" (it won't even confirm it
   exists). Then `policy.ts` checks: is this role allowed to `approve_quote`, and
   is this the client's own org?
4. The **state machine** checks the stage is in `quoted` (you can't approve
   something already paid) — and the pay-gate guard runs on every transition.
5. The DB writes the new status **and** an audit-log row in one atomic batch.

Every weighty action takes this same path. There is exactly **one** function that
mutates a stage (`applyStageAction`), which is why the rules are easy to trust.

---

## 3. Authentication (who you are)

**How it works**
- You enter your email → we email a one-time **magic link** (a 256-bit random
  token). The link works **once** and expires in **15 minutes**.
- Clicking it creates a **session**: a second random token stored in KV
  (`session:<hash> → {userId}`), 30-day sliding expiry. The browser gets an
  `httpOnly`, `Secure`, `SameSite=Lax` cookie holding only that token.
- We store only the **SHA-256 hash** of tokens in KV — a leaked database dump
  yields no usable links or sessions.
- Invite-only: we only send a link to an email that already exists as a user.

**Why this is a good decision**
- **No passwords** = no password database to breach, no reuse, no reset flows,
  no credential-stuffing. The whole class of password attacks disappears.
- Tokens are hashed at rest, single-use, short-lived, and high-entropy
  (brute-forcing a 256-bit token is infeasible).
- `httpOnly` blocks JavaScript/XSS from stealing the cookie; `Secure` keeps it
  on HTTPS; `SameSite=Lax` blocks cross-site request forgery on state-changing
  POSTs (the cookie isn't sent on cross-site form/fetch posts).

**Where I'd attack it → see §7:** login email-bombing (no rate limit), response
**timing** can hint whether an email is a real user, long-lived sessions with no
"log out everywhere," and the fact that **email security = account security**
(inherent to magic links; no second factor).

---

## 4. Authorization (what you may do)

Three independent checks, all server-side:

- **Tenant isolation** — the `ScopedDb` helper adds `organization_id = your org`
  to client reads. A client physically cannot read another company's rows.
- **Visibility** — items flagged `internal` (meeting recordings, AI digests,
  internal notes) are filtered out for clients by the same helper.
- **RBAC** (`policy.ts`) — a pure function answers "may this role take this action
  on this stage?" combining role capability + tenant + ownership (account-owner
  actions need the org's owner; lead actions need the project's lead; admins
  bypass ownership).

**Why this is a good decision**
- The rules are a **pure function** with no database or network in them, so they
  are exhaustively **unit-tested** (cross-org denial, role gates, threshold
  co-sign). The thing most likely to have a subtle bug is the thing most tested.
- Clients get "not found" (not "forbidden") for other orgs' objects, so the app
  never even confirms another company's data exists.

**Where I'd attack it → see §7:** the scoped helper is a **convention, not a
wall** (raw DB access can bypass it), and **all staff currently see all orgs**
(engineer-level scoping isn't built yet).

---

## 5. The money rule (the Stage state machine)

A Stage moves: `draft → quoted → approved → paid → in_progress → delivered →
accepted` (plus `needs_revision`, `rejected`). The hard invariant: **a stage
cannot enter `in_progress` unless it is `paid`** — checked on every transition,
in one code path, even if the row looked paid but had no payment timestamp
(defense in depth). Every change writes an audit row **in the same transaction**,
so "it happened" and "we recorded who did it" can't drift apart.

**Why this is a good decision**
- One mutation path = one place to reason about and test. We have 23 unit tests +
  20 end-to-end checks proving the gate and the role rules.
- The UI asks the server "what actions can this person take now?" and only renders
  those — but the server re-checks anyway, so a tampered UI gains nothing.

**Where I'd attack it → see §7:** **concurrency** (two simultaneous requests can
both pass the check before either writes — no compare-and-swap), and "paid"
currently means **an admin clicked a button**, not that money arrived (Stripe
isn't wired yet).

---

## 6. Why the overall design is sound

- **Server-authoritative.** The UI is never the security boundary; it mirrors
  server decisions and the server re-validates everything.
- **Separation of concerns.** Pure domain logic (state machine, policy) is split
  from I/O (DB, HTTP), which is why the critical rules are unit-testable and were
  in fact tested.
- **Minimal secret footprint.** Auth needs *no* secrets (magic links use a
  Cloudflare binding, sessions live in KV). The only secrets are Stripe's, later.
- **Small attack surface.** Drizzle uses parameterized queries (no SQL injection);
  React escapes output by default (no stored XSS from names/line-items); no
  `dangerouslySetInnerHTML`; inputs are read field-by-field (no mass assignment).
- **Accountability is built in.** An audit trail is written atomically with each
  change.

That combination is well above typical for an early two-person product. The
caveats below are about *hardening for real clients and real money*, not about
the architecture being wrong.

---

## 7. Known limitations & where I'd attack it (the important part)

### 🔴 Fix before real clients / real money

1. **Tenant isolation is a convention, not a hard wall.** `ScopedDb` adds the
   org filter, but a future query written with raw `getDb()` could forget it, and
   SQLite/D1 has no row-level security to catch that. *Risk:* one careless query
   leaks cross-company data. *Fix:* funnel all reads through the scoped layer,
   add a lint/test that fails on raw access, and add automated cross-tenant tests.

2. **All staff can see all organizations.** Today `canSeeAllOrgs = isStaff`, so a
   plain `engineer` can read every client's data — the planned "engineers see
   only assigned work" isn't built. *Risk:* over-broad internal access; a
   compromised low-level account sees everything. *Fix:* scope staff reads by
   project membership / assignment (it slots into the same policy layer).

3. **State-machine concurrency (TOCTOU).** A transition does load → check →
   write with no lock and no `WHERE status = <expected>` guard. *Risk:* two
   simultaneous clicks could double-apply an action (e.g., double-deliver, or
   race around payment). *Fix:* make the update a compare-and-swap
   (`UPDATE ... WHERE id = ? AND status = ?`) and treat "0 rows changed" as
   "someone else moved it."

4. **"Paid" is currently an admin button, not money.** `mark_paid` is a manual
   admin action — the real pay-gate isn't enforced by actual payment yet. *Risk:*
   the core promise ("no work before payment") rests on trust until Stripe is
   wired (signed, idempotent webhook → the `markStagePaidBySystem` seam that's
   already in place). *Fix:* build the Stripe slice; remove/lock the manual path
   in production.

### 🟡 Should fix

5. **No rate limiting anywhere.** Someone could spam the login endpoint to
   email-bomb a known user, or hammer the API. *Fix:* Cloudflare rate-limiting /
   WAF rules on `/api/auth/*` and mutation endpoints.

6. **Login timing can leak whether an email is a real user.** A real user triggers
   token creation + an email send (slower); an unknown email returns immediately.
   The *response body* is identical (good), but *timing* differs. *Fix:* normalize
   work/timing, or accept it as low-risk for an invite-only internal tool.

7. **Denied/forbidden attempts aren't audited.** A client trying to act on another
   org gets a 4xx but leaves no record. *Risk:* no signal for probing/abuse.
   *Fix:* log authorization failures for monitoring.

8. **No security headers.** No Content-Security-Policy, HSTS, or anti-framing
   headers are set. *Fix:* add them at the Worker/Next layer (cheap, high value).

9. **No error monitoring/alerting.** Logs exist (Cloudflare observability) but no
   Sentry-style alerting on failures. *Fix:* wire alerting before production load.

### 🟢 Minor / known trade-offs

10. **Magic links: email = account.** If someone's email is compromised, so is
    their account; there's no second factor. Inherent to passwordless; mitigated
    by single-use + 15-min expiry. Consider MFA for admins later.
11. **Sessions: 30-day sliding, no absolute cap, no "log out all devices."** A
    continuously-used stolen cookie wouldn't time out. *Fix later:* absolute
    lifetime + a session list / global revoke.
12. **CSRF defense is `SameSite=Lax` only** (no anti-CSRF token). Adequate for
    these endpoints, but a token would be defense-in-depth.
13. **Threshold "co-sign" is one admin sending the quote,** not a true two-person
    control with a separate recorded approver (the audit log records who). Fine
    for a small firm; revisit if separation-of-duties matters.
14. **Visibility is enforced at the data layer and unit-tested, but the
    client-facing surfaces that use it** (tasks, files, messages) **aren't built
    yet** — so today there's simply nothing internal exposed to clients. The
    enforcement is ready; the screens that lean on it are upcoming.

---

## 8. How to explain it to a coworker (the short version)

- "**You log in with a link we email you — no passwords.** The link works once and
  expires fast."
- "**The server decides everything; the screen just reflects it.** You can't get
  extra power by messing with the browser."
- "**Each client only ever sees their own company's data,** and never our internal
  stuff."
- "**No work starts until a stage is paid** — that rule lives in one place, is
  tested, and every change is logged with who did it."
- "**It's early and honestly hardened in stages.** Before real clients and real
  money we still need real Stripe payments, tighter limits on who-sees-what
  internally, rate limiting, and a couple of concurrency/operational fixes — all
  listed and tracked." (See §7.)

---

## 9. Where to look in the code

| Concern | File(s) |
|---|---|
| Magic link + sessions | `src/auth/magic-link.ts`, `src/auth/session.ts`, `src/auth/crypto.ts` |
| Who you are (context) | `src/auth/context.ts` |
| Tenant isolation + visibility | `src/db/scoped.ts` |
| RBAC rules (pure, tested) | `src/auth/policy.ts`, `src/auth/policy.test.ts` |
| Pay-gate state machine (pure, tested) | `src/domain/stage-machine.ts`, `src/domain/stage-machine.test.ts` |
| The single mutation path | `src/services/stages.ts` |
| Audit trail | `src/services/audit.ts` |
| API endpoints | `src/app/api/**` |
