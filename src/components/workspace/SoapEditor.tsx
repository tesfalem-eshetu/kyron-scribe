"use client";

import { FileText } from "lucide-react";
import type { NoteSections } from "@/lib/client/types";

const SECTIONS: { key: keyof NoteSections; letter: string; label: string }[] = [
  { key: "subjective", letter: "S", label: "Subjective" },
  { key: "objective", letter: "O", label: "Objective" },
  { key: "assessment", letter: "A", label: "Assessment" },
  { key: "plan", letter: "P", label: "Plan" },
];

function StreamingTag() {
  return (
    <span className="streaming">
      <span className="bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      Generating…
    </span>
  );
}

export function SoapEditor({
  soap,
  onChange,
  readOnly,
  streaming,
  hasContent,
}: {
  soap: NoteSections;
  onChange: (key: keyof NoteSections, value: string) => void;
  readOnly?: boolean;
  streaming?: boolean;
  hasContent: boolean;
}) {
  if (!hasContent && !streaming) {
    return (
      <div className="card soap-card">
        <div className="soap-toolbar">
          <h3>Clinical Note</h3>
        </div>
        <div className="soap-empty">
          <div className="ring">
            <FileText aria-hidden="true" />
          </div>
          <h3>No note generated yet</h3>
          <p>
            Add the visit transcript in Clinical Observations and pick a
            template, then use Generate SOAP Note.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card soap-card">
      <div className="soap-toolbar">
        <h3>Clinical Note</h3>
        {streaming && <StreamingTag />}
      </div>
      {SECTIONS.map((s) => (
        <div className="soap-sec" key={s.key}>
          <div className="sh">
            <span className="soap-letter" aria-hidden="true">
              {s.letter}
            </span>
            <span className="lbl">{s.label}</span>
          </div>
          <textarea
            className={`soap-area${streaming ? " streaming-on" : ""}`}
            value={soap[s.key]}
            readOnly={readOnly}
            aria-label={s.label}
            rows={s.key === "subjective" || s.key === "objective" ? 4 : 5}
            onChange={(e) => onChange(s.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
