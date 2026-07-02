# Proposals — editor & public page (frames 25–26)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 25 — Proposal editor (`/dashboard/sales/proposals/[id]`, staff)
- Breadcrumb + title + status pill (`Draft · v2`). Actions: "◆ Draft new version",
  "Save draft", **"Send to client →"**. **Complexity banner**: amber ⚠ card with
  rationale when >3 (muted one-liner when ≤3). Share-link card appears once **sent**;
  approved/declined banner once responded; a record-response strip (outcome / who /
  note) when sent.
- **A/B is the commercial centerpiece**: title + exec-summary editors, then **two
  option cards side by side** that visually **mirror the public page (26)** — option
  letter tile, name, **price ($, human-set — labeled) + price note**, timeline, and a
  markdown body (What you get / Why this option / Trade-offs). Option B carries the
  green treatment. Assumptions editor below. Prices are **human-set — AI never
  prices**. When complexity >3, the **Send dialog uses harder wording** ("confirm
  engineering has reviewed").

### 26 — Public proposal page (`/p/[token]`, NO login, prospect-facing)
- **The single most client-visible artifact — genuinely mobile-first, signature-
  moment quality.** Ink brand header + mono "PROPOSAL v{n} · prepared for {org} ·
  {date}". Title h1. Exec-summary card (rendered markdown). **"Two ways to do this"**
  → Option A/B cards **stacked on mobile** (side-by-side ≥ tablet), each: option tile,
  name, **big price** (tnum) + price note, timeline pill, markdown body (What you get
  / Why this option / Trade-offs). Assumptions card. **Approve card**: pick A or B
  tiles → "Type your full name to approve" → green **"Approve this proposal"**, with
  the "not a payment, no deposit" reassurance. Footer: "Questions? Reply to your
  Wahala Group contact." After approval, the **selected option gets a green outline +
  "CHOSEN" ribbon** and the banner switches to approved.
