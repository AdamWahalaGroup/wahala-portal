# Sales home / Board (frame 21)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 21 — Board (`/dashboard/sales`, staff) — the Monday-meeting view
The Board is a **true kanban**, not a stacked list. It mirrors how a salesperson
works a whiteboard of sticky notes: unsorted things enter on the left, money exits
on the right. Two view modes toggle in the header (**▦ Board / ☰ List**); Board is
default.

**Header.** Kicker "Sales" + "Pipeline" + Board/List segmented toggle +
**"+ Capture lead"** (ink). A single **condensed summary strip** replaces the old
4 stat cards (the per-stage numbers now live in each column header): Open $ (+
weighted), open deals, an amber **⚠ N stuck 14d+** pill, and Won/Lost·Q with win
rate pushed right.

**Board (21a).** Seven columns, left→right = funnel:
- **Triage** (column 1) — *this replaces the old "New leads to qualify" strip.*
  Leads are no longer duplicated from the Leads page onto the Board; instead the
  Board's first column **is** the lead inbox. Visually distinct (grey fill, dashed
  border) so it reads as "not deals yet." Each lead card = name + mono source +
  score chip; **× to pass**. Caption "drag right to qualify →": dragging a lead
  into Discovery is the qualify action — no separate button to learn.
- **Discovery · Business req. · Solution design · Proposal · Negotiation ·
  Contract** — one column each. Column header = color square + name + count pill +
  ($ sum · ≈N% close). The stuck column tints amber (`#FFFAF2`/`#FADCB4`) and its
  count pill shows "6 · 3⚠". Deal cards = name (cobalt link) + org/owner mono + $
  (tnum) + days tag (≥14d → amber ⚠ stuck tag). Long columns end in a muted
  "+N more · $Xk" overflow line.
- **Won / Lost drop zones** below the columns — dashed drop targets. Drop into Won
  → becomes a project; Lost → reason logged.

**List toggle (21b).** The old stacked-stage table survives as the ☰ List view for
a dense readout: 4 stat cards + six stage sections with per-row stage dropdowns.
Leads are **not** re-listed here either — reduced to a single cobalt-wash nudge bar
("3 new leads waiting to qualify — Review leads →").

**Why this shape.** The kanban makes the workflow self-evident: the funnel is the
layout, so a new hire knows what to do just by looking. Stages remain
**dispositions** — drag any card anywhere, every move logged, never enforced — but
that no longer needs a written caption because the spatial metaphor carries it.
