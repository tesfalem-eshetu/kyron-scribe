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
// The provider generates a plain-English summary from the finalized note,
// edits it, and publishes it to the patient visit record.
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

  // Unsaved edits exist when the textarea diverges from the last saved text.
  const dirty = summary !== null && text !== savedText;

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

  return (
    <div className="card pvs">
      <div className="panel-head">
        <h3>Patient Visit Summary</h3>
        {summary &&
          (summary.status === "PUBLISHED" && !dirty ? (
            <span className="badge badge-finalized">Published</span>
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
          <div className="pvs-empty">
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
        ) : (
          <>
            {summary.stale && (
              <div className="pvs-stale" role="status">
                This summary was generated from note v{summary.noteVersionNumber}.
                The note is now v{summary.currentVersionNumber}. Regenerate it
                from the latest note before publishing.
              </div>
            )}

            {summary.status === "PUBLISHED" && !dirty && summary.publishedAt && (
              <div className="pvs-published">
                Published {relativeTime(summary.publishedAt)}
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
                onClick={saveDraft}
                loading={busy === "save"}
                disabled={!dirty || !text.trim()}
              >
                Save draft
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
          </>
        )}
      </div>
    </div>
  );
}
