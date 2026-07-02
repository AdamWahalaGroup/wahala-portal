# Deal room (frame 24) — most important

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 24 — Deal room (`/dashboard/sales/deals/[id]`, staff) — MOST IMPORTANT
- Full AppShell. Header: breadcrumb, deal name, mono (org · owner · est. value),
  stage badge. A **sales-stage spine** (adapted Stepper) runs across the top:
  Discovery → Business req. → Solution design → Proposal → Negotiation → Contract →
  Won; completed = ink ✓, **current = status-colored ring** (Contract, cyan), a
  **skipped** disposition (Negotiation) renders dashed/muted with a "skipped" label
  (stages are free-move).
- **Two columns; the current stage's action leads.** For a deal in Contract with an
  approved proposal, the **Contract room is first and emphasized** (ink-outlined
  card, dark header with a "NEXT" tag): commercials checklist (MSA/NDA/insurance —
  ✓ + signed date + Undo, or empty box + "Mark signed"), **"Invite {contact} to the
  portal"** (cobalt wash + email + Send), and the green **"◆ Execute contract →
  create project"** (confirm, ~30s, "AI writes the SOW as a real project · marks the
  deal Won"). Then **Proposals** (version rows: v2 Draft ⚠C4 / v1 Approved · Option
  B, C2 chip; "◆ Draft proposal with AI"). Then **Discovery Package** (rendered
  markdown with Edit/Save edits; "+ Paste a transcript" → "◆ Distill & merge" ~20s
  ≈$0.03; note "Wins carry this into the client's AI memory automatically").
- **Right rail**: estimated value ("gut number — real pricing happens at Proposal"),
  stage dropdown ("dispositions — every move logged"), people (deal owner + primary
  contact w/ email·phone), history timeline, provenance ("lead captured … via
  airport bar" + the original note, quoted).
- Ordering rule for the dev: **the section matching the deal's current stage sorts
  to the top and gets the emphasized treatment** (Discovery deal → discovery panel
  leads; approved-proposal deal → contract room leads).
