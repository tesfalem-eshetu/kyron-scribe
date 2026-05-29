"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, Shield } from "lucide-react";
import type { Grounding } from "./types";

export function GroundingPanel({ grounding }: { grounding: Grounding }) {
  const [open, setOpen] = useState(false);

  const hasProblems = grounding.problems.length > 0;
  const hasCandidates = grounding.candidates.length > 0;

  return (
    <div className={`card grounding${open ? " open" : ""}`}>
      <button
        className="g-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Shield className="gi" aria-hidden="true" />
        <span className="gt">AI grounding</span>
        <span className="char-meta">what the model was allowed to use</span>
        <ChevronDown className="chev" aria-hidden="true" />
      </button>
      <div className="g-body">
        <div className="g-block">
          <div className="gl">Extracted problems</div>
          {hasProblems ? (
            grounding.problems.map((p, i) => (
              <div className="g-prob" key={i}>
                <CircleCheck aria-hidden="true" /> {p.phrase}
              </div>
            ))
          ) : (
            <div className="char-meta">None extracted.</div>
          )}
        </div>
        <div className="g-block">
          <div className="gl">Supported ICD-10 candidates</div>
          {hasCandidates ? (
            grounding.candidates.map((c) => (
              <div className="g-cand" key={c.code}>
                <span className="code">{c.code}</span>
                <span className="d">{c.description}</span>
              </div>
            ))
          ) : (
            <div className="char-meta">No supported codes from local catalog.</div>
          )}
        </div>
      </div>
    </div>
  );
}
