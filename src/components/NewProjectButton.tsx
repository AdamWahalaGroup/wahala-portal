"use client";

import { useState } from "react";
import { CreateProjectForm } from "@/components/CreateProjectForm";

/** "+ New project" affordance for the staff Projects screen — toggles the create form. */
export function NewProjectButton({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 15px",
          fontSize: 13.5,
          fontWeight: 600,
          background: "var(--ink)",
          color: "var(--white)",
          cursor: "pointer",
        }}
      >
        {open ? "Cancel" : "+ New project"}
      </button>
      {open && (
        <div style={{ marginTop: 12, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            New project
          </div>
          <CreateProjectForm orgs={orgs} />
        </div>
      )}
    </div>
  );
}
