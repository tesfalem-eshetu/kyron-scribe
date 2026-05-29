"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import type { SaveState } from "./types";

export function SavedIndicator({
  state,
  relTime,
  version,
}: {
  state: SaveState;
  relTime: string;
  version?: number | null;
}) {
  if (state === "saving") {
    return (
      <span className="saved is-saving">
        <Loader2 className="spin" aria-hidden="true" /> Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="saved is-error">
        <CircleAlert aria-hidden="true" /> Save failed
      </span>
    );
  }
  return (
    <span className="saved is-saved">
      <Check aria-hidden="true" /> Saved {relTime}
      {version ? (
        <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
          {" "}
          · v{version}
        </span>
      ) : null}
    </span>
  );
}
