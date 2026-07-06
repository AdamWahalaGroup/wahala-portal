# Calendar, meetings & integrations — frames 42–48 · 06 Jul 2026

> Supplements [`README.md`](README.md). Read [`design-system.md`](design-system.md) +
> [`patterns.md`](patterns.md) first; deal-drawer anatomy is in [`CRM-RESTRUCTURE.md`](CRM-RESTRUCTURE.md).
> The canvas (`Wahala Portal.dc.html`) is UPDATED — frames 42–48 are the new bottom band.
> Context: Google Calendar OAuth already works in the codebase; Zoom is **not** connected
> yet (no company account) — the no-Zoom states below are the launch reality, not an edge case.

## 0 · Principles

1. **No calendar page.** Google Calendar already is one. Meetings render on the objects
   they belong to: the deal drawer, the account timeline, staff home (one strip), the
   client project page.
2. **"Next step" becomes a real event.** The free-text next-step card (frame 29) upgrades
   to a linked Google event when one exists. Free text remains valid for non-meeting steps.
3. **One `MeetingCard` component, five states.** Same card everywhere; states below.
   Never hide a button because an integration is missing — **degrade loudly** with the
   dashed "no video link" row.
4. **Close the AI loop.** Events are the spine the existing recording → transcript →
   ◆ AI digest pipeline hangs off. "Merged from 2 calls" provenance points at events.
5. **Connect is easy, disconnect is deliberate** (frame 48 — fixes a real accidental
   disconnect that happened in testing).

## 1 · Data model

```
meetings
  id · google_event_id (unique) · google_calendar_id
  account_id? · deal_id? · project_id?      -- ≥1 set once linked; null = inbox (45)
  title · starts_at · ends_at · attendees jsonb (email, name?, response)
  video_url? · video_provider ('zoom' | 'manual' | null)
  status: upcoming → imminent → live → ended → awaiting_recording → digest_ready
          (imminent/live are computed from clock, not stored)
  recording_file_id? · transcript_id? · digest_id?   -- reuse existing call-digest tables
  created_by · source ('portal' | 'google')
```

- **Sync scope:** per-member OAuth (each staff member connects their own Google account,
  frame 47). Pull events that have ≥1 non-`@wahala.co` attendee; skip all-day events and
  events with no other attendees. Personal calendars never sync in.
- **Auto-match:** attendee email == account contact → link; else attendee domain ==
  account domain → *suggest* (inbox row, frame 45); else unmatched inbox row.
  "Not client work" stores a suppression (event + recurring series) — teaches the matcher.
- **Vocabulary:** these are **calls/meetings**, never "Stages"/"steps". "Schedule call"
  = future; the existing "Log a call" = past. Both sit in the drawer footer.

## 2 · Frame-by-frame

### Frame 42 — Deal drawer · meetings on the deal
- Next-step card, when linked to an event: cobalt-tinted card (`#FAFBFF` / `#C9D0FB`
  border) with mono `NEXT STEP` label + **`synced · Google Calendar`** chip (cobalt wash
  pill, right-aligned). Title = event title; mono meta `Thu 9 Jul · 10:00–10:45 · set by
  Ada`; attendee avatars + mono invite status (`invite sent · Dana accepted`, from Google
  attendee responses).
- **No-Zoom row** (launch state): dashed 1px `#D7D9DF` row inside the card — mono
  `no video link yet — connect Zoom to add Join · or paste a link` ("connect Zoom" is a
  cobalt link → frame 47; "paste a link" inline-edits `video_url`, provider `manual`).
- Buttons: ink `Done → next` (existing) + ghost `Reschedule` (opens frame 44 prefilled;
  updates the Google event, does not recreate).
- **After the call · automatic** card: mono pipeline `recording → transcript → ◆ AI
  digest → deal facts` + caption. Until Zoom cloud recording exists, the recording slot
  accepts manual upload (same slot the digest pipeline already reads).
- Activity ("Latest") logs calendar ops: `Event created in Google Calendar · invite to
  Dana · Ada`.
- Footer order: **Draft proposal** (ink) · **Schedule call** (ghost, new) · **Log a call**
  (ghost). Mono caption: `Schedule = future · Log = past`.

### Frame 43 — `MeetingCard` states (component)
State ramp: `upcoming → imminent (T−15m) → live → ended · awaiting recording → digest ready`.
1. **Upcoming** — quiet: gray dot, 1px `#E7E8EC` border, ghost `Copy invite`, caption
   `Join appears 15 min before start`.
2. **Imminent** (T−15 min → start) — cobalt border + wash, dot gets the focus-ring glow,
   mono countdown `in 6 min`, **cobalt primary `Join Zoom →`** + ghost `Copy link`.
   Live = same treatment, label `live now` (amber dot).
3. **Zoom not connected** — full card renders; where Join would sit: dashed row
   `no video link · connect Zoom in Settings → or paste a link`. Never an absent button.
4. **Ended → digest ready** — green dot + `digest ready` badge (accepted-green pill);
   links `◆ AI digest →` / `transcript →`; mono `merged into deal facts`.
   Interim `awaiting recording`: gray pill + spinner dot; if no recording 2h after end,
   swap to a manual-upload prompt.
- Join gating is client-side clock vs `starts_at` (T−15m), same rule staff & client.

### Frame 44 — Schedule a call (modal, from deal footer)
- Header mono: `creates a Google Calendar event on {member email} · lives on this deal`.
- **Title** prefilled `"{deal one-liner} — {Account} × Wahala"`.
- **With** — chips from the account's contacts (frame 33's contact records); `+ add`
  opens contact picker; a contact with no email gets the amber `⚠ add email` chip
  treatment (same as frames 29/33) and can't be invited.
- **When** — 3 suggested slots from the member's free/busy (working hours only) as
  tappable chips; selected = cobalt border/wash; `pick a time…` opens a plain
  date-time input. Duration default 45 min, `change` link.
- **Video** — Zoom toggle **disabled** with caption `connect Zoom in Settings to enable ·
  recording + digest need this`; below it a dashed mono paste-input
  `…or paste a meeting link for now`. When Zoom connects, toggle defaults ON and the
  paste input hides.
- **Send Google invite to {contact}** toggle, default ON; OFF = `hold on your calendar only`.
- Footer: ink `Create event` · ghost `Cancel` · mono `becomes the deal's next step`.
- On create: insert Google event (+ invite if toggled), write `meetings` row linked to
  the deal, set it as the deal's next step, log to Latest.

### Frame 45 — Staff home · today strip + meeting inbox
- **Today strip** sits under the staff-home greeting (frame 17), ONE row: current/next
  matched meeting (title bold, mono cobalt `10:00 · in 6 min`), the rest of the day
  compressed to mono `then 14:30 Kickoff — Talden · 16:00 internal`, `Join` button
  (cobalt when imminent, else hidden). Strip hides entirely on meeting-free days.
  Clicking a title opens that deal's drawer.
- **Meeting inbox** — synced events that didn't auto-match. Row: title + mono time,
  mono reason line (`tom@harborpoint.com — looks like Harbor Point marina (domain
  match)`). Actions: ink `Link to deal` (one click when there's a suggestion) or ghost
  `Choose deal…` (picker), + ghost `Not client work` (suppresses, teaches matcher).
  Inbox lives on staff home below the strip; badge count on it when non-empty.

### Frame 46 — Client portal · next call
- Card on the client project page (with frame 03's card treatments): cobalt-tinted,
  mono label `YOUR NEXT CALL WITH WAHALA`, title, mono time **in the client's timezone**
  (`(your time)`), account-owner avatar row.
- Buttons: ink `Join call` (same T−15m gating; before that the button area reads
  `starts Thursday 10:00`) + ghost `Add to calendar` → **.ics download** (works with
  Outlook/Apple/Google — never a Google-only link; no account needed).
- `ask to reschedule →` link opens Messages with a prefilled thread to the account
  owner — no email back-and-forth, and no client-side self-service rescheduling (the
  owner owns the calendar).
- No Google/Zoom branding client-side; it's just "your call with Wahala".

### Frame 47 — Settings · Integrations (`/dashboard/settings/integrations`)
- **Google Calendar row (connected):** G tile · green `Connected` pill · mono
  `{email} · connected {date} · last sync {rel} · N upcoming events matched` · mono
  scopes line `read & write events · free/busy — nothing else`.
  Actions column (right): ghost `Sync now` on top; **`Disconnect…` is a quiet underlined
  text link** below it — small, gray, ellipsis signals a dialog follows. It must not be
  a button, must not sit adjacent-inline to `Sync now` (stacked, with gap), and clicking
  it does nothing destructive — it only opens frame 48.
- **Zoom row (not connected):** dashed border, gray `Not connected` pill, value copy
  (Join buttons, auto-attach on schedule, recording → digest), mono caption
  `needs a company Zoom account (admin) · until then, paste links manually — cards show
  the "no video link" state`. Ink `Connect Zoom` button — connect is the big obvious
  action, disconnect never is.
- Per-workspace page; each member connects their own Google via their row/sign-in.

### Frame 48 — Disconnect · guarded confirm  ⚠ fixes a live bug
Motivation: an accidental single click on "Disconnect" currently disconnects Google
Calendar instantly. That must be impossible.
- Modal `Disconnect Google Calendar?` + mono account email. Consequence cards:
  1. amber ⚠ `N upcoming meetings stop syncing — cards keep their last-known time but
     go stale, marked "unsynced"` (N is live, from the meetings table);
  2. neutral: `"Schedule call" and free/busy suggestions turn off everywhere`;
  3. green ✓ `Nothing is deleted — past digests, transcripts and deal history stay.
     Reconnecting restores sync.`
- **Arming checkbox** `I understand meetings will stop syncing` — the destructive
  button is disabled (washed-out red `#E5B3B3` on `#F0CACA` border) until checked.
- **Keep connected** is the ink primary and holds initial focus — Enter/Esc/click-outside
  all keep the connection. `Disconnect` is the bordered destructive secondary.
- After a confirmed disconnect: toast with **Undo (30s)** — undo restores the stored
  refresh token without re-auth. Only after the window lapses is the token revoked.
- Same pattern applies to any future integration disconnect (Zoom, Stripe).

## 3 · Build notes

- **Islands:** MeetingCard countdown/gating, schedule modal, inbox actions, the arming
  checkbox. Everything else renders server-side off the `meetings` table.
- **Sync:** webhook/watch channel per connected calendar with a polling fallback
  (`last sync {rel}` in frame 47 is real). Google is the source of truth for time and
  attendee responses; the portal is the source of truth for linkage (deal/account).
- **Zoom later:** when connected, `Schedule call` auto-attaches a meeting link
  (provider `zoom`), cloud recordings flow into the existing digest pipeline keyed by
  `google_event_id`/`meeting_id`, and frame 43·3 stops appearing. No other UI changes —
  that's the point of designing the degraded state first.
