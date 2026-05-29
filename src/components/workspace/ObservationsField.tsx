"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DictationControls } from "@/components/workspace/DictationControls";

function appendTranscript(existing: string, addition: string): string {
  if (!existing.trim()) return addition;
  return `${existing.replace(/\s*$/, "")}\n\n${addition}`;
}

export function ObservationsField({
  value,
  onChange,
  onGenerate,
  generating,
  hasContent,
}: {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  hasContent: boolean;
}) {
  return (
    <div className="card">
      <div className="panel-head">
        <h3>Clinical Observations</h3>
        <span className="char-meta">{value.length} chars</span>
      </div>
      <div className="panel-body">
        <textarea
          className="textarea obs-area"
          value={value}
          placeholder="Type, paste, or dictate the raw visit transcript…"
          onChange={(e) => onChange(e.target.value)}
          aria-label="Clinical observations transcript"
        />
        <DictationControls
          onAppend={(text) => onChange(appendTranscript(value, text))}
          onReplace={(text) => onChange(text)}
          disabled={generating}
        />
      </div>
      <div className="obs-foot">
        <Button
          variant={hasContent ? "secondary" : "primary"}
          onClick={onGenerate}
          loading={generating}
        >
          {!generating &&
            (hasContent ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            ))}
          {generating
            ? "Generating…"
            : hasContent
              ? "Regenerate"
              : "Generate SOAP Note"}
        </Button>
      </div>
    </div>
  );
}
