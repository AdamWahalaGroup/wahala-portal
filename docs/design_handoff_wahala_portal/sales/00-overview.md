# Sales pipeline — overview & cross-cutting decisions

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

## Sales pipeline (CRM front half) — frames 21–27

The sales half (**Lead → Deal → Discovery → Proposal → Contract → Project**) was
built feature-by-feature and needed a coherent design pass. These frames are LIVE,
working software — every listed data point/action already exists; this is a
redesign, not new features. Tokens match `src/lib/theme.ts` exactly.

### Cross-cutting decisions (apply to all sales screens)
- **Information architecture — Sales is a first-class destination with sub-nav.**
  The ink AppShell sidebar is now: Home / **Sales** / Clients / Projects / Files
  *(soon)* / Messages / Settings *(admin)*. **Sales expands to a sub-nav: Board ·
  Leads · Proposals** (indented, left-ruled, cobalt `#2B3EE6` active pill; Leads
  carries a count badge). The main content also repeats these as a segmented tab
  control so the destination is reachable two ways — fixes "the user couldn't find
  Leads." Deep detail pages (deal room excepted) use a **breadcrumb top bar**
  instead of re-rendering the whole shell, to maximize content width.
- **One chip system** (replaces the ad-hoc chips):
  - **Score chip** (lead 1–10 + verdict): pill, verdict-colored — **pursue** green
    (`#DCF5E3`/`#15803D`, dot `#16A34A`), **probe** amber (`#FCEFDC`/`#B45309`, dot
    `#D97706`), **pass/not-scored** muted (`#F1F2F4`/`#6B7280`). Number is mono/tnum:
    `8/10 · PURSUE`.
  - **Complexity chip** (proposal 1–5): `C{n}`; ≤3 neutral cobalt (`#EEF0FE`/
    `#2536C4`), **>3 amber with ⚠** (`#FCEFDC`/`#B45309`) — a soft flag, never a gate.
  - **Proposal status pill**: draft grey (`#F1F2F4`/`#4B5159`), sent blue (`#E8EFFE`/
    `#1D4ED8`), approved green (`#DCF5E3`/`#15803D`), declined soft-red (`#FBE3E3`/
    `#B91C1C`), superseded muted. Mirrors the stage `STATUS_STYLES` scale.
  - **Days-in-stage tag**: mono, neutral `#F4F5F7` (`6d`); **≥14d becomes the amber
    ⚠ stuck tag** (`#FFF7ED`/`#FADCB4`/`#B45309`).
  - **Stage dropdown**: one select style (white, `#E2E3E8` border, `▾`). Sales
    stages are **dispositions** — any→any, always logged; never enforced.
- **Markdown editor/preview pattern** (replaces raw monospace textareas on staff
  screens): default to **rendered markdown** (styled headings/bullets/bold via the
  built-in `SimpleMarkdown`), with **Edit / Save edits** toggling into a textarea.
  The public page (26) always renders. AI buttons keep the **`◆ ` prefix**, a busy
  state with rough duration ("Distilling… ~20s"), and a cost note (≈$0.03).
