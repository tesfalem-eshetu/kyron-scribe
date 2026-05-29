"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

// Patient-facing visit summary, shown once the encounter has a finalized note.
// A published summary stays collapsed until the provider opens or edits it, so
// finalized patient-facing content is not editable by accident.
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
  const [busy, setBusy] = useState<null | "generate" | "save" | "publish">(null);

  // A published summary collapses to a compact card; expanded/editing control
  // whether the body is open and whether the textarea is editable.
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const dirty = summary !== null && text !== savedText;
  const isPublished = summary?.status === "PUBLISHED";

  const applySummary = useCallback((next: VisitSummary | null) => {
    setSummary(next);
    setText(next?.summaryText ?? "");
    setSavedText(next?.summaryText ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch<VisitSummaryState>(base);
        if (cancelled) return;
        applySummary(res.summary);
        // Drafts open for editing; published summaries start collapsed.
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

  async function saveDraft(): Promise<VisitSummary | null> {
    setBusy("save");
    try {
      const res = await apiFetch<VisitSummary>(base, {
        method: "PATCH",
        body: { summaryText: text },
      });
      applySummary(res);
      return res;
    } catch (error) {
      toast.push({
        type: "error",
        message: isApiError(error) ? error.message : "Could not save the summary.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (dirty) {
      const saved = await saveDraft();
      if (!saved) return;
    }
    setBusy("publish");
    try {
      const res = await apiFetch<VisitSummary>(`${base}/publish`, {
        method: "POST",
      });
      applySummary(res);
      // Collapse once published so the patient-facing content is put away.
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

  function renderBadge() {
    if (!summary) return null;
    return isPublished && !dirty ? (
      <span className="badge badge-finalized">Published</span>
    ) : (
      <span className="badge badge-draft">Draft</span>
    );
  }

  const collapsedPublished = isPublished && !expanded;

  return (
    <div className="card pvs">
      <div className="panel-head">
        <h3>Patient Visit Summary</h3>
        {renderBadge()}
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
        ) : collapsedPublished ? (
          <div className="pvs-body-enter pvs-collapsed">
            <div className="pvs-published">
              {summary.publishedAt
                ? `Published ${relativeTime(summary.publishedAt)}`
                : "Published"}
            </div>
            {summary.stale && (
              <div className="pvs-stale" role="status">
                Built from note v{summary.noteVersionNumber}; the note is now v
                {summary.currentVersionNumber}. Regenerate before republishing.
              </div>
            )}
            <div className="pvs-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  setEditing(false);
                }}
              >
                Open
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
        ) : (
          <div className="pvs-body-enter">
            {summary.stale && (
              <div className="pvs-stale" role="status">
                This summary was generated from note v{summary.noteVersionNumber}.
                The note is now v{summary.currentVersionNumber}. Regenerate it
                from the latest note before publishing.
              </div>
            )}

            {isPublished && !editing && !dirty && summary.publishedAt && (
              <div className="pvs-published">
                Published {relativeTime(summary.publishedAt)}
              </div>
            )}

            {editing || !isPublished ? (
              <textarea
                className="textarea pvs-area"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Patient visit summary"
                placeholder="Patient-friendly visit summary…"
              />
            ) : (
              <div className="pvs-readonly">{text}</div>
            )}

            <div className="pvs-actions">
              {isPublished && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExpanded(false);
                    setEditing(false);
                    setText(savedText);
                  }}
                >
                  Close
                </Button>
              )}
              {isPublished && !editing ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={saveDraft}
                  loading={busy === "save"}
                  disabled={!dirty || !text.trim()}
                >
                  Save draft
                </Button>
              )}
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
                {isPublished && !dirty ? "Republish" : "Publish to patient visit"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
