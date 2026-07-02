# Wahala Portal — Design brief: the Sales pipeline (CRM front half)

Hand this whole file to Claude Design. It describes a large set of **newly shipped,
functional-but-disjointed screens** that were built feature-by-feature and now need a
coherent design pass. Everything below is LIVE at portal.wahala-services.com — this is
a redesign of working software, so every listed data point and action already exists
and must survive the redesign. Frame numbers continue from the existing canvas
(`Wahala Portal.dc.html`, last frame 20).

## Context — what got built

The portal used to start at "create project" (delivery only). We built the entire
**sales front half** on top of it, following our pipeline model (see
`docs/brain_storming/synthesis.md` for the philosophy):

**Lead → (qualify) → Deal → Discovery → Proposal (Option A/B, public share link) →
Contract room → Execute → Project (the existing delivery machine takes over).**

Key vocabulary (matches the canvas glossary; new terms in bold):
- **Lead** — an unowned trap: a name + whatever we know. Lives in a **workspace** with
  a file **dump** and an **AI scout report** (1–10 score + pursue/probe/pass verdict).
- **Deal** — one opportunity, moving through sales **stages** (dispositions — freely
  movable, never enforced): Discovery → Business requirements → Solution design →
  Proposal → Negotiation → Contract → Won/Lost. Days-in-stage with a ⚠ stuck flag at 14d.
- **Discovery Package** — AI-distilled markdown from pasted call transcripts, on the deal.
- **Proposal** — versioned; always exactly **Option A / Option B**; AI-drafted,
  human-priced; complexity 1–5 chip (⚠ above 3 = "needs engineering review", soft);
  **public share page** (no login) where the prospect approves with a typed name.
- **Contract room** — commercials checklist (MSA/NDA/insurance), client portal invite,
  and **Execute** (AI writes the SOW as a real project; deal → Won).
- Delivery **Phases** (existing frames) are untouched.

## Design language already in the app (match it)

Tokens: `--ink #16181d` · `--ink-soft #3a3f47` · `--muted #767b85` · `--border #e7e8ec`
· `--surface #f4f5f7` · `--surface-soft #fbfbfc` · cobalt `#2b3ee6` (wash `#eef0fe`) ·
radii 9/12/999/16 · card + modal shadows. Existing components reused throughout: ink
sidebar AppShell, kicker labels, mono metadata lines, StatusBadge, PeopleCard/Avatar,
Money (tabular), HistoryTimeline, amber "on you" tint `#fff7ed`/`#fadcb4`, green
confirm `#16a34a`, soft-red decline. AI actions use a "◆ " prefix on ink buttons.

## The core problem to solve

These screens were accreted, not designed:
1. **No information architecture for Sales.** The sidebar has one "Sales" item; leads,
   deals, and proposals hang off it via small inline links people miss. Decide the
   nav model (sub-nav? tabs? hub page?) — the user literally couldn't find Leads.
2. **The deal page is a pile.** One long column: header → editable fields card →
   Discovery Package (paste box + big markdown textarea) → Proposals list → Contract
   room (bordered box) → provenance → right rail (value, stage select, people,
   history). It reads as six unrelated widgets. It's the single most important screen —
   it should read as a **deal room** with a clear "where are we / what's next" spine
   (the sales stages could mirror the delivery Stepper pattern).
3. **Inconsistent chips/buttons.** Score chips (`8/10 · PURSUE`), complexity chips
   (`⚠ C4`), proposal status pills, stage dropdowns, and days-in-stage tags were each
   styled ad hoc. Needs one chip system.
4. **Raw markdown textareas everywhere.** Discovery Package and proposal editors are
   monospace textareas; the public page renders markdown nicely but staff screens
   don't. Decide the editor/preview pattern (tabs? side-by-side? styled on blur?).

## Screens to design (new frames)

### Frame 21 — Sales home  ·  `/dashboard/sales`  (staff)
Today: 4 stat cards (Open pipeline $, Open deals, Stuck 14d+, Won/Lost) → lead
quick-capture form (6 inline inputs + "+ Add lead") → new-lead rows (name link,
detail mono, owner select, Qualify/Pass buttons, expandable qualify form with org
select + deal name + value) → "Pipeline": six stage groups as stacked lists, each
deal row = name link · org/contact/owner mono · $ · days chip · stage dropdown →
Won section. Small "All leads →" text link (missed by the user).
**Ask:** one coherent funnel view; make Leads a first-class destination; keep the
probability-anchor chips ("≈10% → proposal") and stuck flags prominent — this is the
Monday-meeting screen ("why does Jason have 20 deals stuck in solution design?").

### Frame 22 — Leads list  ·  `/dashboard/sales/leads`  (staff)
Today: three stacked groups (To qualify / Qualified / Passed), rows with name, score
chip, detail mono, owner + date. **Ask:** triage-first layout; score/verdict as the
visual anchor; a home for the quick-capture form (it may belong here more than on 21).

### Frame 23 — Lead workspace  ·  `/dashboard/sales/leads/[id]`  (staff)
Today, stacked: status chip header (+ "View the deal →" if converted) → qualify/pass/
assign row (only while new) → "Record" card (6 inputs + notes textarea + save) →
**"The dump"** (drop-files button, file rows with icon/name/size/uploader, download,
remove) → **"Scout report"** (score chip `8/10 · PURSUE`, "◆ Analyze this lead"
(~40s), last-run timestamp, rendered markdown report with fixed sections: The read /
Web intel with source URLs / Associations & angles / Red flags / Next moves / Score
rationale). **Ask:** make this feel like a scout's dossier — the dump and the report
are the stars; the record fields are secondary. Design the empty state (no files, no
report) and the long-report state.

### Frame 24 — Deal room  ·  `/dashboard/sales/deals/[id]`  (staff) — MOST IMPORTANT
All current content listed in "the pile" above, plus per-section actions:
- Discovery: "+ paste a transcript" → blue paste box → "◆ Distill & merge" (~20s,
  ≈$0.03) → editable markdown + "Save edits"; note "Wins carry this into the client's
  AI memory automatically."
- Proposals: version rows (v2 `Draft` / v1 `Approved · Option B` pills, complexity
  chip) + "◆ Draft proposal with AI" (~20s).
- Contract room (appears once a proposal is approved): checklist rows (MSA/NDA/
  insurance, ☐/✅ + "Mark signed"/Undo + signed date), "Invite {contact} to the
  portal" + email, "◆ Execute contract → create project" (green, confirm dialog,
  ~30s) → executed state links to the project.
- Right rail: estimated value ("gut number — pricing happens at Proposal"), stage
  dropdown ("stages are dispositions… every move is logged"), people (deal owner,
  primary contact + email/phone), history timeline, provenance ("lead captured …
  via airport bar" + original note).
**Ask:** a stage-progress spine across the top (reuse/adapt the Stepper), and the
sections organized so the CURRENT stage's action is the obvious next thing (deal in
Discovery → discovery panel forward; approved proposal → contract room forward).

### Frame 25 — Proposal editor  ·  `/dashboard/sales/proposals/[id]`  (staff)
Today: breadcrumb, title + status pill (`Draft/Sent/Approved/Declined/Superseded ·
v2`), complexity banner (amber ⚠ if >3, with rationale; muted line if ≤3), share-link
card (sent+), approved/declined banner, then editors: title input, exec-summary
textarea, two option cards side by side (name, price $ + price note — "human-set",
timeline, summary textarea), assumptions textarea. Actions: Save draft, "Send to
client →" (confirm dialog; harder wording when complexity >3), record-response strip
(outcome select / who / note) when sent, "◆ Draft new version with AI".
**Ask:** the A/B comparison should look like the commercial centerpiece it is;
staff editor should visually preview what the prospect will see (frame 26).

### Frame 26 — Public proposal page  ·  `/p/[token]`  (NO login, prospect-facing)
Today: Brand header + "Proposal v2 · prepared for {org} · date", title h1, approved/
declined banner when responded, exec summary card (rendered markdown), "Two ways to
do this" — Option A/B cards side by side (Option label, name, big price + price note,
timeline mono, markdown body: What you get / Why this option / Trade-offs), assumptions
card, approve card (pick A or B tiles → "Type your full name to approve" → green
"Approve this proposal"; "not a payment and there is no deposit" note), footer
"Questions? Reply to your Wahala Group contact." **Ask:** this is the single most
client-visible artifact of the company — make it beautiful, mobile-first, signature-
moment worthy. Selected option gets a green outline + "chosen" after approval.

### Frame 27 — Admin settings  ·  `/dashboard/settings`  (admin only)
Today: "AI agents" section, one card per agent (6: Project draft/SOW writer,
Discovery analyst, Proposal writer, Task breakdown, Lead scout, Lead recon):
label + `default · gpt-4o-mini` / `custom · gpt-4o` chip, description line, model
input (datalist suggestions), reasoning-effort select (Off/Minimal/Low/Medium/High —
hidden for recon), Save, warning line about reasoning on non-reasoning models.
**Ask:** simple, calm, admin-tool aesthetic; room to grow (future knobs: complexity
threshold, stuck-days window, probability anchors).

### Small updates to existing frames
- **Frame 17 (staff home):** added a one-line "Sales pipeline" strip under the two
  revenue cards ($ open · N deals · N leads to qualify · ⚠ stuck badge → links to 21).
  Consider promoting it.
- **Project page:** "Hand off to team →" panel (lead select + engineer checkboxes) in
  the People row; phase page Tasks header gained "◆ Generate tasks" (internal tasks).
- **Sidebar:** now Home / Sales / Clients / Projects / Files(soon) / Messages /
  Settings (admin). Decide whether Sales gets a sub-nav (Board · Leads · maybe
  Proposals) — see problem #1.

## Constraints
- React server components + client islands, **inline styles with the tokens above,
  no new dependencies**, no CSS frameworks. Markdown renders through a tiny built-in
  renderer (headings, bullets, bold only).
- Staff screens are desktop-first (960px content column in the ink AppShell); the
  public proposal page (26) must be genuinely mobile-first.
- Every action listed exists and is wired; don't design actions that don't exist.
  AI buttons show a busy state with a rough duration ("Distilling… ~20s") and a cost
  note (≈$0.03) — keep both, they build trust.
- Clients NEVER see leads, deals, proposals-in-progress, internal tasks, or the dump.
  The only prospect-facing surface is frame 26.

## What to deliver
Same as previous rounds: updated canvas + per-frame HTML/spec files we can drop into
`docs/design_handoff_wahala_portal/`. Prioritize **24 (deal room) → 21 (sales home) →
26 (public proposal) → 23 (lead workspace)**; the rest can trail.
