# Staff home & projects

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 16 — Projects, staff (`/dashboard/projects`) — grouped by client
- **Purpose:** A staff cross-client list of all projects, **cleanly separated by
  client** so each client's work reads as its own block.
- **Layout:** page header ("Projects · Across all your clients" + search + a
  **"Draft with AI"** button (cobalt-outline, ◆) and a primary **"+ New project"**
  button (ink `#16181D`) on the right of the header — see frames 18–20 for the AI
  flow);
  then one **client group** per org — a heading row (org avatar + name + project
  count + the assigned Wahala person on the right) with a 2px ink underline,
  followed by that client's project rows (name + work-type/stage meta +
  StatusBadge + chevron). Groups are visually distinct (heading divider + spacing)
  so clients never blur together. Respects tenant scoping (only orgs the staffer
  can see). **Note:** "New project" lives **here**, not on the staff home (frame 17).

### 17 — Staff home / admin landing (`/dashboard`, staff role) — clients & revenue
- **Purpose:** The **Wahala admin's landing page**. Deliberately **not** a project
  or stage worklist — it answers "who are my clients and where does the money
  stand." It does **NOT** show a projects list or active-stage cards (those live on
  the Projects page / stage screens).
- **Layout:** standard staff shell — 228px ink sidebar (wahala logo; **"Wahala
  Group / all clients"** org switcher; nav Home *(active)* / Clients / Projects /
  Files / Messages; **Ada Obi · "Wahala admin"** pinned bottom) + main column.
- **Main:**
  - Header: mono date + **"Good morning, {name}."**, with search + admin avatar.
  - **Two revenue summary cards** (2-col): **"Collected to date"** (green-tinted,
    `#F4FBF7`/`#D6EFE4`, green dot) showing total **accepted & paid** (`$27,700`,
    sub "Across N clients · accepted & paid"); and **"Promised on completion"**
    (amber-tinted, `#FFFAF2`/`#FADCB4`, amber dot) showing total **in-flight +
    approved-quote value invoiced as stages complete** (`$32,100`, sub "In-flight +
    approved quotes · invoiced as stages complete"). Big numbers are mono/tnum
    32px 800.
  - **Clients table**: header row ("Clients" + "N active"); a column-label row
    (Client / Paid to date / Promised — last two right-aligned mono uppercase);
    then one row per client = org avatar tile + name + mono "N projects · owner
    {name}" sub-line, **Paid to date** (ink mono/tnum, greyed `$0` if none),
    **Promised** (amber mono/tnum), chevron. Rows clickable → that client's account
    hub (frame 12).
- **Definitions for the developer:**
  - **Paid to date** = sum of stages with status **accepted & paid** for that
    client (lifetime collected).
  - **Promised** = sum of **in-progress** stages + **approved/quoted** stages not
    yet paid — i.e. committed value that will be invoiced as those stages complete.
  - Summary-card totals are the column sums across all visible (tenant-scoped)
    clients.
- **Islands:** none required (static, server-rendered) beyond the org switcher.
