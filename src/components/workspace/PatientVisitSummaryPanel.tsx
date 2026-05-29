"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, isApiError } from "@/lib/client/api";
import { relativeTime } from "@/lib/client/format";

interface VisitSummary {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  summaryText: string;
  followUpText: string | null;
  noteVersionNumber: number | null;
  currentVersionNumber: number | null;
  stale: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface VisitSummaryState {
  hasFinalizedNote: boolean;
  summary: VisitSummary | null;
}

const AUTOSAVE_DELAY_MS = 900;
const EXCERPT_WORDS = 50;

function excerpt(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= EXCERPT_WORDS) return text.trim();
  return `${words.slice(0, EXCERPT_WORDS).join(" ")}…`;
}

// Patient-facing visit summary, shown once the encounter has a finalized note.
// Drafts auto-save and stay open; a published summary collapses to a compact
// card (excerpt + actions) until the provider expands or edits it.
export function PatientVisitSummaryPanel({
  encounterId,
  currentVersion,
}: {
  encounterId: string;
  currentVersion: number;
}) {
  const toast = useToast();
  const base = `/api/provider/encounters/${encounterId}/patient-visit-summary`;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [busy, setBusy] = useState<null | "generate" | "publish" | "discard">(
    null,
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // expanded/editing apply to a published summary: collapsed -> expanded
  // read-only -> editing.
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = summary !== null && text !== savedText;
  const isPublished = summary?.status === "PUBLISHED";

  const applySummary = useCallback((next: VisitSummary | null) => {
    setSummary(next);
    setText(next?.summaryText ?? "");
    setSavedText(next?.summaryText ?? "");
    setSaveState("idle");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch<VisitSummaryState>(base);
        if (cancelled) return;
        applySummary(res.summary);
        const draft = res.summary?.status === "DRAFT";
        setExpanded(Boolean(draft));
        setEditing(Boolean(draft));
      } catch {
        if (!cancelled) applySummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch when a new note version is finalized so the stale flag refreshes.
  }, [base, currentVersion, applySummary]);

  // Debounced autosave while editing. Editing a published summary returns it to
  // draft on the server, so the badge flips to Draft on the first change.
  useEffect(() => {
    if (!editing || !summary) return;
    if (!text.trim() || text === savedText) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<VisitSummary>(base, {
          method: "PATCH",
          body: { summaryText: text },
        });
        setSummary(res);
        setSavedText(res.summaryText);
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, savedText, editing, summary, base]);

  async function generate() {
    setBusy("generate");
    try {
      const res = await apiFetch<VisitSummary>(`${base}/generate`, {
        method: "POST",
      });
      applySummary(res);
      setExpanded(true);
      setEditing(true);
      toast.push({ type: "success", message: "Patient summary generated" });
    } catch (error) {
      toast.push({
        type: "error",
        message: isApiError(error)
          ? error.message
          : "Unable to generate patient visit summary. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    // Flush any pending edit before publishing.
    if (dirty && text.trim()) {
      try {
        const saved = await apiFetch<VisitSummary>(base, {
          method: "PATCH",
          body: { summaryText: text },
        });
        setSavedText(saved.summaryText);
      } catch (error) {
        toast.push({
          type: "error",
          message: isApiError(error) ? error.message : "Could not save the summary.",
        });
        return;
      }
    }
    setBusy("publish");
    try {
      const res = await apiFetch<VisitSummary>(`${base}/publish`, {
        method: "POST",
      });
      applySummary(res);
      setExpanded(false);
      setEditing(false);
      toast.push({ type: "success", message: "Published to patient visit" });
    } catch (error) {
      toast.push({
        type: "error",
        message: isApiError(error) ? error.message : "Could not publish the summary.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    setBusy("discard");
    try {
      await apiFetch<void>(base, { method: "DELETE" });
      applySummary(null);
      setExpanded(false);
      setEditing(false);
      toast.push({ type: "info", message: "Patient summary discarded" });
    } catch (error) {
      toast.push({
        type: "error",
        message: isApiError(error) ? error.message : "Could not discard the summary.",
      });
    } finally {
      setBusy(null);
    }
  }

  const showEditing = Boolean(summary) && editing;
  const showCollapsed = Boolean(summary) && isPublished && !expanded && !editing;

  return (
    <div className="card pvs">
      <div className="panel-head">
        <h3>Patient Visit Summary</h3>
        {summary &&
          (isPublished && !dirty ? (
            <span className="pvs-head-meta">
              <span className="badge badge-finalized">Published</span>
              {summary.publishedAt && (
                <span className="pvs-head-time">
                  {relativeTime(summary.publishedAt)}
                </span>
              )}
            </span>
          ) : (
            <span className="badge badge-draft">Draft</span>
          ))}
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="pvs-state" aria-live="polite">
            <Loader2 className="spin" aria-hidden="true" /> Loading…
          </div>
        ) : !summary ? (
          <div className="pvs-body-enter pvs-empty">
            <p>
              No patient-facing summary has been created for this visit. Generate
              a plain-English summary from the finalized note, review it, then
              publish it to the patient visit record.
            </p>
            <Button variant="primary" onClick={generate} loading={busy === "generate"}>
              {busy !== "generate" && <Sparkles aria-hidden="true" />}
              Generate summary
            </Button>
          </div>
        ) : showCollapsed ? (
          <div className="pvs-body-enter pvs-collapsed">
            {summary.stale && (
              <div className="pvs-stale" role="status">
                Built from note v{summary.noteVersionNumber}; the note is now v
                {summary.currentVersionNumber}. Regenerate before republishing.
              </div>
            )}
            <p className="pvs-excerpt">{excerpt(summary.summaryText)}</p>
            <div className="pvs-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  setEditing(false);
                }}
              >
                Expand
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={generate}
                loading={busy === "generate"}
              >
                Regenerate
              </Button>
            </div>
          </div>
        ) : showEditing ? (
          <div className="pvs-body-enter">
            {summary.stale && (
              <div className="pvs-stale" role="status">
                This summary was generated from note v{summary.noteVersionNumber}.
                The note is now v{summary.currentVersionNumber}. Regenerate it
                from the latest note before publishing.
              </div>
            )}
            <textarea
              className="textarea pvs-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Patient visit summary"
              placeholder="Patient-friendly visit summary…"
            />
            <div className="pvs-actions">
              <span className="pvs-savestate" aria-live="polite">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Draft saved"
                    : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDiscard(true)}
                loading={busy === "discard"}
              >
                Discard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={generate}
                loading={busy === "generate"}
              >
                Regenerate
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={publish}
                loading={busy === "publish"}
                disabled={!text.trim()}
              >
                Publish to patient visit
              </Button>
            </div>
          </div>
        ) : (
          <div className="pvs-body-enter">
            {summary.stale && (
              <div className="pvs-stale" role="status">
                This summary was generated from note v{summary.noteVersionNumber}.
                The note is now v{summary.currentVersionNumber}. Regenerate it
                from the latest note before publishing.
              </div>
            )}
            <div className="pvs-readonly">{summary.summaryText}</div>
            <div className="pvs-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpanded(false);
                  setEditing(false);
                }}
              >
                Close
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={generate}
                loading={busy === "generate"}
              >
                Regenerate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </div>
          </div>
        )}
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard patient summary?"
          body="This permanently removes the patient visit summary for this encounter. You can generate a new one from the finalized note at any time."
          confirmLabel="Discard"
          tone="danger"
          onConfirm={discard}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}
