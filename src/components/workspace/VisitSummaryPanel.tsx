"use client";

import { Lock, Sparkles } from "lucide-react";

// Pioneer feature — UI-only stub. The patient-friendly visit summary publish
// flow has no backend yet, so this panel only reflects availability state.
export function VisitSummaryPanel({ available }: { available: boolean }) {
  return (
    <div className="card vs-card">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3>Visit Summary</h3>
          <span className="tool-tag" style={{ marginLeft: 8 }}>
            <Sparkles aria-hidden="true" /> Coming soon
          </span>
        </div>
      </div>
      <div className="vs-locked">
        <Lock aria-hidden="true" />
        <p>
          {available
            ? "A patient-friendly visit summary will be available here in a future release."
            : "A patient-friendly visit summary becomes available after you save a final version of the note."}
        </p>
      </div>
    </div>
  );
}
