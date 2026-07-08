# Handoff delta — first production QA pass · 08 Jul 2026

> Supplements [`README.md`](README.md), [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md), and
> [`HANDOFF-DELTA-2026-07-04.md`](HANDOFF-DELTA-2026-07-04.md). Source: the founder ran the
> lead→won script against production for the first time. Five findings — two are production
> bugs against the existing spec, three are spec gaps now decided. The interactive prototype
> (`Wahala Portal - Interactive.dc.html`) has been updated for items 1 and 2 — use it as the
> reference behavior.

## 1 · Capture must not lose data between Triage and the deal  🐛 prod bug + spec gap

**Observed:** a contact saved to Triage with an est. value showed no estimate in the contact
drawer, and qualifying later produced a deal without it.

**Decision:** est. value, the intake note ("what they need"), and **owner** are stored on the
**contact** at capture — not discarded, not deal-only. When the contact is qualified (from
Triage or via bypass), all three carry onto the new deal: `value`, `discoveryNote`, `owner`.
Nothing entered at capture is ever re-typed.

- The capture modal (frame 32) gains an **Owner** select (defaults to the current user),
  sitting beside Est. value. Prototype shows the layout.
- The Triage card shows the estimate when present: mono `$25,000` + `est · {owner}` sub-line.
  Prototype shows the treatment.
- The contact drawer/peek must display est. value, intake note, source, and owner.

## 2 · Qualify must never ask for an account  🐛 prod bug

**Observed:** qualifying a Triage contact only offered existing accounts, with no way to
create one.

**Per the existing spec (CRM-RESTRUCTURE §1/§3):** the account is created **at capture** —
the Account combobox in the capture modal has "+ create new" which creates an account inline
with just a name. Every contact therefore already has an `account_id` by the time it can be
qualified. Qualify = flip contact state + create the deal on the contact's existing account.
If production's capture path allows a contact with no account, that's the bug to fix — do not
add an account picker to the qualify step.

## 3 · Portal invite stays at project creation — but acceptance auto-links the contact

**Suggestion raised:** invite by email at contact creation; auto-add the person as a
contact + primary on first login.

**Decision — split it:**
- **No portal invite at capture.** Pre-sale, the client-facing surface is the public proposal
  link (`/p/{token}`), which is deliberately login-free — no login wall between the client and
  yes. The portal invite moment stays where frame 35 puts it: after **Create project →**
  (and any time from the Account page → Contacts). Do not add an invite checkbox to the
  capture modal.
- **Yes to the automation on acceptance:** accepting an invite links the login to the existing
  contact record (matched by email). If no contact with that email exists on the account,
  create one on first login. If the account has no primary contact, the accepted invitee
  becomes primary. No duplicate person records, ever ("one record forever").

## 4 · Invite state ≠ lead state — never auto-add invitees to Triage

**Concern raised:** a lead in Triage (sales page) plus a pending invite (account page) reads
like the same person in two states in two places.

**Decision:** they are different axes and stay separate — **portal access** (none → invited →
accepted) is about the login; **qualification state** (to_qualify → qualified/passed) is about
the sales process. An invited contact is not necessarily a lead; a Triage contact should
usually not have portal access yet (see §3 — invites come post-win).

Fix the *presentation*, not the model: the Account page contact row (frame 33) shows **both**
chips side by side on the one contact record — e.g. `to qualify` (sales state, when relevant
to staff) and `invited · awaiting first login` (grey pill) / `portal · accepted` (green pill).
One row, one person, both facts. Since invites normally happen after a deal is won, the
overlap window should be rare by design.

## 5 · Client portal: no dead nav items  🐛 UX bug

**Observed:** a freshly-invited client clicking **Projects** got nothing — no page, no
feedback.

**Decision:** every client nav item always routes to a real page. An empty Projects page
shows a proper empty state: short line ("No projects yet — when work begins it will appear
here, phase by phase"), plus the account owner's name/avatar and a "Message {owner}" action.
Same rule for Files and Messages. Never disable or hide nav to avoid building an empty
state; the empty state IS the accountability pitch (a named human, even on day zero).

## Prototype changes shipped with this delta

`Wahala Portal - Interactive.dc.html`:
- Capture modal: Owner select added (Est. value · Owner two-up grid).
- Contact records now persist `estValue`, `notes`, `owner` from capture.
- Triage cards render the estimate + owner sub-line when present.
- Qualify (from Triage) carries value/owner/discovery note onto the created deal — deals no
  longer start at $0 when the estimate was captured.
- (From the 07 Jul + earlier session: proposal sign/manual advance to Committed now always
  derives `proposalPhases` from the signed option and seeds the agreement/deposit checklist
  for accounts that lack one — the Committed → Create project dead-end is fixed for
  non-seeded deals.)
