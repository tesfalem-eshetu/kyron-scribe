"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRealtimeDictation } from "@/lib/client/useRealtimeDictation";

const WARN_THRESHOLD_MS = 30_000;

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Voice dictation sits beside the transcript field. The provider speaks, reviews
// the transcript, then appends or replaces the observations text. Inserted text
// rides the existing draft autosave; dictation never auto-generates a note.
export function DictationControls({
  onAppend,
  onReplace,
  disabled,
}: {
  onAppend: (text: string) => void;
  onReplace: (text: string) => void;
  disabled?: boolean;
}) {
  const dictation = useRealtimeDictation();
  const {
    status,
    mode,
    liveText,
    reviewText,
    remainingMs,
    error,
    startRealtime,
    startFallback,
    stop,
    reset,
  } = dictation;

  const timeLow = remainingMs <= WARN_THRESHOLD_MS;

  const append = () => {
    if (reviewText.trim()) onAppend(reviewText.trim());
    reset();
  };
  const replace = () => {
    onReplace(reviewText.trim());
    reset();
  };

  return (
    <div className="dictation">
      <div className="dictation-bar">
        <span className="dictation-label">Voice dictation</span>

        {status === "idle" && (
          <button
            type="button"
            className="mic-btn"
            onClick={startRealtime}
            disabled={disabled}
            aria-label="Start voice dictation"
          >
            <Mic aria-hidden="true" />
          </button>
        )}

        {(status === "requesting-mic" || status === "connecting") && (
          <span className="dictation-state">
            <span className="rec-dot connecting" aria-hidden="true" />
            {status === "requesting-mic"
              ? "Waiting for microphone…"
              : "Connecting…"}
            <button className="link-btn" onClick={reset} type="button">
              Cancel
            </button>
          </span>
        )}

        {status === "recording" && (
          <span className="dictation-state">
            <span className="rec-dot" aria-hidden="true" />
            <span className="dictation-mode">
              {mode === "fallback" ? "Recording" : "Listening"}
            </span>
            <span
              className={`dictation-timer${timeLow ? " warn" : ""}`}
              aria-label={`${formatClock(remainingMs)} remaining`}
            >
              {formatClock(remainingMs)}
            </span>
            <Button variant="secondary" size="sm" onClick={stop}>
              Stop
            </Button>
          </span>
        )}

        {(status === "transcribing" || status === "stopping") && (
          <span className="dictation-state">
            <span className="rec-dot connecting" aria-hidden="true" />
            Transcribing…
          </span>
        )}
      </div>

      {status === "recording" && mode === "realtime" && (
        <div className="dictation-preview live" aria-live="polite">
          {liveText || (
            <span className="dictation-hint">Speak now. Transcript appears here…</span>
          )}
        </div>
      )}

      {status === "review" && (
        <div className="dictation-review">
          <div className="dictation-preview" aria-live="polite">
            {reviewText || (
              <span className="dictation-hint">No speech was transcribed.</span>
            )}
          </div>
          <div className="dictation-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={append}
              disabled={!reviewText.trim()}
            >
              Append to transcript
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={replace}
              disabled={!reviewText.trim()}
            >
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="dictation-error" role="alert">
          <span>{error}</span>
          <div className="dictation-actions">
            {mode === "realtime" && (
              <Button variant="secondary" size="sm" onClick={startFallback}>
                Record instead
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
