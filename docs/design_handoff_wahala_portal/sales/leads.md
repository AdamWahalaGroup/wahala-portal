# Leads — list & workspace (frames 22–23)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 22 — Leads list (`/dashboard/sales/leads`, staff) — score-first triage
- Breadcrumb header + To-qualify / Qualified / Passed count tabs. **Quick-capture**
  lives here (dashed cobalt card, name/company/source inputs + "+ Add lead") — a
  name is enough. **To qualify**: rows with a large left **score+verdict block** as
  the visual anchor, name + mono detail, Qualify/Pass. Unscored rows show a
  "not scored / ◆ Analyze" affordance. **Qualified**: muted rows linking to the
  created deal ("View the deal →").

### 23 — Lead workspace (`/dashboard/sales/leads/[id]`, staff) — the scout's dossier
- Breadcrumb + name + status chip (`New · unowned`; if converted, a "View the deal
  →" link). **Qualify → deal / Pass / Assign** row shows only while `new`.
- **The dump and the scout report are the stars** (main column, ~2/3 width); the
  **Record** fields are secondary (right rail, compact inputs + notes + Save).
  - **The dump**: "⤓ Drop files" + file rows (type chip / name / mono size · uploader
    / download / remove). Always internal.
  - **Scout report**: header = big **score chip `8/10 · PURSUE`** + "◆ Analyze this
    lead" (~40s) + last-run timestamp. Body is rendered markdown with fixed sections:
    **The read / Web intel** (with source URLs) **/ Associations & angles / Red flags**
    (amber heading) **/ Next moves / Score rationale** (green callout).
  - **Empty state** (design it): dump = dashed dropzone "Drop anything you have on
    this lead"; report = ◆ icon + "No scout report yet — ◆ Analyze to score this lead
    (~40s)". **Long-report state**: report card scrolls within a max-height; sections
    keep their headings sticky-optional.
