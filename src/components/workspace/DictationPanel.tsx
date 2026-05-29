"use client";

import { Mic } from "lucide-react";

// Pioneer feature — UI-only stub. Real audio capture/transcription is not yet
// implemented; this panel intentionally performs no network or device access.
export function DictationPanel() {
  return (
    <div className="card dictation">
      <div className="panel-head">
        <h3>Dictation</h3>
        <span className="tool-tag">
          <Mic aria-hidden="true" /> Coming soon
        </span>
      </div>
      <div className="panel-body">
        <button className="dict-start" disabled aria-disabled="true">
          <span className="mic-orb" aria-hidden="true">
            <Mic />
          </span>
          <span className="dict-start-text">
            <span className="lbl">Start dictation</span>
            <span className="hint">
              Live transcription into Clinical Observations — available in a future
              release.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
