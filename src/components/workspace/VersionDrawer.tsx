"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  Lock,
  Loader2,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { apiFetch, isApiError } from "@/lib/client/api";
import { formatDateTime } from "@/lib/client/format";
import type { NoteSections, NoteVersion } from "@/lib/client/types";

const SECTIONS: { key: keyof NoteSections; letter: string; label: string }[] = [
  { key: "subjective", letter: "S", label: "Subjective" },
  { key: "objective", letter: "O", label: "Objective" },
  { key: "assessment", letter: "A", label: "Assessment" },
  { key: "plan", letter: "P", label: "Plan" },
];

function sectionsOf(v: NoteVersion): NoteSections {
  return {
    subjective: v.subjective,
    objective: v.objective,
    assessment: v.assessment,
    plan: v.plan,
  };
}

export function VersionDrawer({
  encounterId,
  currentSoap,
  savedByName,
  onClose,
}: {
  encounterId: string;
  currentSoap: NoteSections;
  savedByName: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteVersion | null>(null);
  const [compare, setCompare] = useState(false);
  const ref = useFocusTrap<HTMLElement>(() => {
    if (selected) {
      setSelected(null);
      setCompare(false);
    } else {
      onClose();
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { versions } = await apiFetch<{ versions: NoteVersion[] }>(
          `/api/provider/encounters/${encounterId}/note/versions`,
        );
        if (cancelled) return;
        setVersions(
          [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
        );
      } catch (err) {
        if (!cancelled)
          setError(
            isApiError(err) ? err.message : "Could not load version history.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  const currentVersion =
    versions.length > 0 ? versions[0].versionNumber : 0;
  const empty = !loading && !error && versions.length === 0;

  return (
    <>
      <div className="drawer-scrim" onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Version History"
        tabIndex={-1}
      >
        <div className="drawer-head">
          {selected ? (
            <button
              className="ver-back"
              onClick={() => {
                setSelected(null);
                setCompare(false);
              }}
            >
              <ChevronLeft aria-hidden="true" /> Version History
            </button>
          ) : (
            <h3>Version History</h3>
          )}
          <button
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          {loading && (
            <div className="icd-state loading">
              <Loader2 className="spin" aria-hidden="true" /> Loading versions…
            </div>
          )}

          {error && (
            <div className="ver-empty">
              <div className="ring">
                <History aria-hidden="true" />
              </div>
              <h3>Could not load history</h3>
              <p>{error}</p>
            </div>
          )}

          {empty && (
            <div className="ver-empty">
              <div className="ring">
                <History aria-hidden="true" />
              </div>
              <h3>No saved versions yet</h3>
              <p>
                Save the note to create version 1. Each saved version is kept as
                an immutable record.
              </p>
            </div>
          )}

          {!loading && !error && !selected && versions.length > 0 && (
            <>
              {versions.map((v) => (
                <button
                  className={`ver ver-row${
                    v.versionNumber === currentVersion ? " current" : ""
                  }`}
                  key={v.id}
                  onClick={() => setSelected(v)}
                >
                  <div className="vbadge">v{v.versionNumber}</div>
                  <div className="vmeta">
                    <div className="vtop">
                      <span className="vname">
                        {v.saveReason || `Version ${v.versionNumber}`}
                      </span>
                      {v.versionNumber === currentVersion && (
                        <span
                          className="badge badge-finalized"
                          style={{ height: 18, fontSize: 10 }}
                        >
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="vby">
                      {savedByName} ·{" "}
                      <span className="vtime">{formatDateTime(v.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="vchev" aria-hidden="true" />
                </button>
              ))}
            </>
          )}

          {selected && (
            <>
              <div className="ver-detail-head">
                <div className="vdh-left">
                  <div className="vbadge lg">v{selected.versionNumber}</div>
                  <div>
                    <div className="vname">
                      {selected.saveReason || `Version ${selected.versionNumber}`}
                    </div>
                    <div className="vby">
                      {savedByName} ·{" "}
                      <span className="vtime">
                        {formatDateTime(selected.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="ro-badge">
                  <Lock aria-hidden="true" /> Read-only
                </span>
              </div>

              <div className="ver-actions">
                <button
                  className={`btn btn-sm ${
                    compare ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setCompare((c) => !c)}
                  disabled={selected.versionNumber === currentVersion}
                >
                  <Copy aria-hidden="true" />{" "}
                  {compare ? "Hide comparison" : "Compare with current"}
                </button>
                {selected.versionNumber === currentVersion && (
                  <span className="ver-iscurrent">
                    This is the current version
                  </span>
                )}
              </div>

              {SECTIONS.map((s) => {
                const selSections = sectionsOf(selected);
                return (
                  <div className="ro-sec" key={s.key}>
                    <div className="sh">
                      <span className="soap-letter" aria-hidden="true">
                        {s.letter}
                      </span>
                      <span className="lbl">{s.label}</span>
                    </div>
                    {compare ? (
                      <div className="ro-compare">
                        <div className="ro-col">
                          <div className="ro-coltag">v{selected.versionNumber}</div>
                          <div className="ro-text">
                            {selSections[s.key] || (
                              <span className="ro-empty">— empty —</span>
                            )}
                          </div>
                        </div>
                        <div className="ro-col">
                          <div className="ro-coltag cur">
                            Current · v{currentVersion}
                          </div>
                          <div className="ro-text">
                            {currentSoap[s.key] || (
                              <span className="ro-empty">— empty —</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ro-text">
                        {selSections[s.key] || (
                          <span className="ro-empty">— empty —</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
