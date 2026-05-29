"use client";

import { useLayoutEffect, useRef } from "react";
import { FileText } from "lucide-react";
import type { NoteSections } from "@/lib/client/types";

const SECTIONS: { key: keyof NoteSections; letter: string; label: string }[] = [
  { key: "subjective", letter: "S", label: "Subjective" },
  { key: "objective", letter: "O", label: "Objective" },
  { key: "assessment", letter: "A", label: "Assessment" },
  { key: "plan", letter: "P", label: "Plan" },
];

// A textarea that grows to fit its content so providers never scroll inside an
// individual SOAP section; the whole note reads as one continuous document.
function AutoTextarea({
  value,
  readOnly,
  streaming,
  label,
  onChange,
}: {
  value: string;
  readOnly?: boolean;
  streaming?: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Resize whenever the value changes (typing and streaming tokens) and on
  // mount; also recompute on viewport width changes since reflow alters height.
  useLayoutEffect(() => {
    resize();
  }, [value]);

  useLayoutEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <textarea
      ref={ref}
      className={`soap-area${streaming ? " streaming-on" : ""}`}
      value={value}
      readOnly={readOnly}
      aria-label={label}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

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
          <AutoTextarea
            value={soap[s.key]}
            readOnly={readOnly}
            streaming={streaming}
            label={s.label}
            onChange={(value) => onChange(s.key, value)}
          />
        </div>
      ))}
    </div>
  );
}
