"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileQuestion,
  History,
  Loader2,
  Lock,
  Save,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  initialsOf,
  useCurrentUser,
} from "@/components/providers/CurrentUserProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PatientCard } from "@/components/workspace/PatientCard";
import { TemplateSelect } from "@/components/workspace/TemplateSelect";
import { ObservationsField } from "@/components/workspace/ObservationsField";
import { Icd10Widget } from "@/components/workspace/Icd10Widget";
import { SoapEditor } from "@/components/workspace/SoapEditor";
import { GroundingPanel } from "@/components/workspace/GroundingPanel";
import { VersionDrawer } from "@/components/workspace/VersionDrawer";
import { SavedIndicator } from "@/components/workspace/SavedIndicator";
import type { Grounding, SaveState } from "@/components/workspace/types";
import { apiFetch, isApiError } from "@/lib/client/api";
import { useGenerateStream } from "@/lib/client/useGenerateStream";
import { parseSoapSections } from "@/lib/client/parseSoap";
import { relativeTime } from "@/lib/client/format";
import type {
  EncounterDraftResponse,
  EncounterStatus,
  NoteSections,
  NoteVersion,
  PatientSummary,
  ProviderTemplate,
} from "@/lib/client/types";

const EMPTY_SOAP: NoteSections = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

interface RightAlert {
  type: "warning" | "error" | "info";
  title: string;
  body: string;
}

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const user = useCurrentUser();
  const { start: startStream, isStreaming } = useGenerateStream();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [status, setStatus] = useState<EncounterStatus>("DRAFT");
  const [templates, setTemplates] = useState<ProviderTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateArchived, setTemplateArchived] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [soap, setSoap] = useState<NoteSections>(EMPTY_SOAP);
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const [finalizedOnServer, setFinalizedOnServer] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [rightAlert, setRightAlert] = useState<RightAlert | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, tick] = useState(0);

  // refs to read latest values inside debounced autosave
  const transcriptRef = useRef(transcript);
  const soapRef = useRef(soap);
  const templateRef = useRef(templateId);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    transcriptRef.current = transcript;
    soapRef.current = soap;
    templateRef.current = templateId;
  }, [transcript, soap, templateId]);

  // tick the "saved Xs ago" label
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // initial load: draft + active templates + base version
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [draftRes, tplRes, versionsRes] = await Promise.all([
          apiFetch<EncounterDraftResponse>(
            `/api/provider/encounters/${id}/draft`,
          ),
          apiFetch<{ templates: ProviderTemplate[] }>(
            "/api/provider/templates",
          ),
          apiFetch<{ versions: NoteVersion[] }>(
            `/api/provider/encounters/${id}/note/versions`,
          ),
        ]);
        if (cancelled) return;

        setPatient(draftRes.patient);
        setStatus(draftRes.encounterStatus);
        setFinalizedOnServer(draftRes.encounterStatus === "FINALIZED");
        setTranscript(draftRes.draft.transcript ?? "");
        setTemplates(tplRes.templates);

        const selected = draftRes.draft.selectedTemplateId;
        setTemplateId(selected);
        if (selected && !tplRes.templates.some((t) => t.id === selected)) {
          setTemplateArchived(true);
        }

        // The authoritative SOAP for a saved note is its latest immutable
        // NoteVersion. Seed the editor from it when one exists; otherwise fall
        // back to the autosaved draft (a note that hasn't been saved yet).
        const versions = versionsRes.versions;
        const latest =
          versions.length > 0
            ? versions.reduce((a, b) =>
                b.versionNumber > a.versionNumber ? b : a,
              )
            : null;
        if (latest) {
          setSoap({
            subjective: latest.subjective,
            objective: latest.objective,
            assessment: latest.assessment,
            plan: latest.plan,
          });
        } else {
          setSoap({
            subjective: draftRes.draft.subjective ?? "",
            objective: draftRes.draft.objective ?? "",
            assessment: draftRes.draft.assessment ?? "",
            plan: draftRes.draft.plan ?? "",
          });
        }
        setSavedAt(draftRes.draft.lastSavedAt);
        setBaseVersion(latest?.versionNumber ?? 0);
      } catch (error) {
        if (cancelled) return;
        if (isApiError(error) && error.code === "NOT_FOUND") {
          setNotFound(true);
        } else {
          setLoadError(
            isApiError(error) ? error.message : "Failed to load the encounter.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scheduleAutosave = useCallback(() => {
    if (finalizedOnServer) return; // draft is locked once finalized server-side
    setSaveState("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        const body: Record<string, unknown> = {
          transcript: transcriptRef.current,
          subjective: soapRef.current.subjective,
          objective: soapRef.current.objective,
          assessment: soapRef.current.assessment,
          plan: soapRef.current.plan,
        };
        if (templateRef.current) body.selectedTemplateId = templateRef.current;
        await apiFetch(`/api/provider/encounters/${id}/draft`, {
          method: "PATCH",
          body,
        });
        setSaveState("saved");
        setSavedAt(new Date().toISOString());
      } catch (error) {
        if (isApiError(error) && error.code === "DRAFT_FINALIZED") {
          setFinalizedOnServer(true);
          setSaveState("saved");
          return;
        }
        setSaveState("error");
      }
    }, 900);
  }, [id, finalizedOnServer]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function editTranscript(value: string) {
    setTranscript(value);
    setDirty(true);
    scheduleAutosave();
  }

  function editTemplate(value: string) {
    setTemplateId(value);
    setTemplateArchived(false);
    setDirty(true);
    scheduleAutosave();
  }

  function editSection(key: keyof NoteSections, value: string) {
    setSoap((s) => ({ ...s, [key]: value }));
    setDirty(true);
    scheduleAutosave();
  }

  function pickIcd(item: {
    code: string;
    description: string;
  }) {
    setSoap((s) => ({
      ...s,
      assessment:
        (s.assessment ? s.assessment.replace(/\s*$/, "") + "\n" : "") +
        `ICD-10: ${item.code} — ${item.description}`,
    }));
    setDirty(true);
    scheduleAutosave();
    toast.push({ type: "info", message: `Added ${item.code} to Assessment` });
  }

  const hasContent = Object.values(soap).some((v) => v.trim().length > 0);

  async function generate() {
    setRightAlert(null);
    if (!templateId) {
      setRightAlert({
        type: "warning",
        title: "Select a template.",
        body: "Choose a note template before generating.",
      });
      return;
    }
    setGrounding(null);
    setSoap(EMPTY_SOAP);
    setStatus("GENERATING");
    // Bring the SOAP panel into view so the provider can watch it stream in.
    window.scrollTo({ top: 0, behavior: "smooth" });

    await startStream({
      encounterId: id,
      transcript,
      templateId,
      onMetadata: (meta) =>
        setGrounding({
          problems: meta.problems,
          candidates: meta.icd10Candidates,
        }),
      onText: (full) => setSoap(parseSoapSections(full)),
      onDone: (refused, full) => {
        if (refused) {
          setStatus("ERROR");
          setSoap(EMPTY_SOAP);
          setRightAlert({
            type: "warning",
            title: "Not enough clinical information to generate a note.",
            body: "Add symptoms, exam findings, assessment, or plan and try again.",
          });
          return;
        }
        const parsed = parseSoapSections(full);
        setSoap(parsed);
        setStatus("GENERATED");
        soapRef.current = parsed;
        toast.push({ type: "success", message: "SOAP note generated" });
        scheduleAutosave();
      },
      onError: (error) => {
        setStatus("DRAFT");
        setSoap(EMPTY_SOAP);
        if (error.code === "INSUFFICIENT_CLINICAL_CONTENT") {
          setRightAlert({
            type: "warning",
            title: "Not enough clinical information to generate a note.",
            body: "Add symptoms, exam findings, assessment, or plan and try again.",
          });
        } else if (error.code === "TEMPLATE_UNAVAILABLE") {
          setTemplateArchived(true);
          setRightAlert({
            type: "warning",
            title: "Template unavailable.",
            body: "The selected template is no longer available. Choose another template and try again.",
          });
          toast.push({
            type: "error",
            message: "Generation blocked — template archived",
          });
        } else {
          setRightAlert({
            type: "error",
            title: "Generation failed.",
            body: error.message,
          });
        }
      },
    });
  }

  async function doSave() {
    if (!hasContent) {
      toast.push({
        type: "error",
        message: "Add note content before saving a final version.",
      });
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{ versionNumber: number }>(
        `/api/provider/encounters/${id}/save-note`,
        {
          method: "POST",
          body: {
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
            baseVersionNumber: baseVersion,
          },
        },
      );
      setBaseVersion(result.versionNumber);
      setStatus("FINALIZED");
      setFinalizedOnServer(true);
      setDirty(false);
      setSaveState("saved");
      setSavedAt(new Date().toISOString());
      toast.push({
        type: "success",
        message: `Saved as version ${result.versionNumber}`,
      });
    } catch (error) {
      if (isApiError(error) && error.code === "VERSION_CONFLICT") {
        setConflict(true);
      } else {
        toast.push({
          type: "error",
          message: isApiError(error) ? error.message : "Could not save the note.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function reloadLatest() {
    setConflict(false);
    try {
      const { versions } = await apiFetch<{
        versions: {
          versionNumber: number;
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
        }[];
      }>(`/api/provider/encounters/${id}/note/versions`);
      if (versions.length > 0) {
        const latest = versions.reduce((a, b) =>
          a.versionNumber > b.versionNumber ? a : b,
        );
        setSoap({
          subjective: latest.subjective,
          objective: latest.objective,
          assessment: latest.assessment,
          plan: latest.plan,
        });
        setBaseVersion(latest.versionNumber);
        setStatus("FINALIZED");
        setFinalizedOnServer(true);
        toast.push({
          type: "info",
          message: `Reloaded latest — now v${latest.versionNumber}`,
        });
      }
    } catch {
      toast.push({ type: "error", message: "Could not reload the latest note." });
    }
  }

  if (loading) {
    return (
      <div className="ws">
        <WorkspaceTopBar initials={initialsOf(user.fullName)} />
        <div
          className="icd-state loading"
          style={{ padding: 64 }}
          aria-live="polite"
        >
          <Loader2 className="spin" aria-hidden="true" /> Loading encounter…
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="ws">
        <WorkspaceTopBar initials={initialsOf(user.fullName)} />
        <div className="center-stage">
          <div className="empty">
            <div className="ring">
              <FileQuestion aria-hidden="true" />
            </div>
            <h3>Encounter not found</h3>
            <p>
              This encounter does not exist or you do not have access to it.
            </p>
            <Button variant="primary" onClick={() => router.push("/encounters")}>
              Back to Encounters
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !patient) {
    return (
      <div className="ws">
        <WorkspaceTopBar initials={initialsOf(user.fullName)} />
        <div className="center-stage">
          <div className="empty">
            <div className="ring">
              <X aria-hidden="true" />
            </div>
            <h3>Could not load encounter</h3>
            <p>{loadError ?? "Please try again."}</p>
            <Button variant="secondary" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showFinalizedChip = status === "FINALIZED" && !dirty;
  const hasVersions = baseVersion > 0;
  const hasHeaderActions = hasVersions || hasContent;

  return (
    <div className="ws">
      <WorkspaceTopBar initials={initialsOf(user.fullName)} />

      <div className="ws-head">
        <div className="ph-left">
          <div className="ph-avatar" aria-hidden="true">
            {initialsOf(`${patient.firstName} ${patient.lastName}`)}
          </div>
          <div className="ph-id">
            <div className="name">
              {patient.lastName}, {patient.firstName}
            </div>
            <div className="meta">
              <span className="dob">DOB {patient.dateOfBirth.slice(0, 10)}</span>
            </div>
          </div>
        </div>
        <div className="ph-right">
          <div className="status-saved">
            <StatusBadge status={status} />
            <SavedIndicator
              state={saveState}
              relTime={relativeTime(savedAt)}
              version={baseVersion || null}
            />
          </div>
          {hasHeaderActions && (
            <>
              <div className="hdiv" aria-hidden="true" />
              <div className="actions">
                {hasVersions && (
                  <Button variant="ghost" onClick={() => setDrawerOpen(true)}>
                    <History aria-hidden="true" /> Version History
                  </Button>
                )}
                {showFinalizedChip ? (
                  <span
                    className="btn btn-secondary"
                    style={{
                      cursor: "default",
                      color: "var(--green-600)",
                      borderColor: "var(--success-border)",
                      background: "var(--success-bg)",
                    }}
                  >
                    <Lock aria-hidden="true" /> Finalized · v{baseVersion}
                  </span>
                ) : (
                  hasContent && (
                    <Button
                      variant="primary"
                      onClick={doSave}
                      loading={saving}
                      disabled={isStreaming}
                    >
                      {!saving && <Save aria-hidden="true" />} Save Final Note
                    </Button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ws-body">
        <div className="col-left">
          <PatientCard patient={patient} />
          <Icd10Widget onPick={pickIcd} />
          <TemplateSelect
            templates={templates}
            value={templateArchived ? null : templateId}
            onChange={editTemplate}
            archived={templateArchived}
            disabled={isStreaming}
          />
          <ObservationsField
            value={transcript}
            onChange={editTranscript}
            onGenerate={generate}
            generating={isStreaming}
            hasContent={hasContent}
          />
        </div>

        <div className="col-right">
          {rightAlert && (
            <div className={`alert alert-${rightAlert.type}`} role="alert">
              <span className="alert-title">{rightAlert.title} </span>
              {rightAlert.body}
              <button
                className="btn btn-ghost btn-icon btn-sm"
                style={{ height: 22, width: 22, marginLeft: "auto" }}
                aria-label="Dismiss"
                onClick={() => setRightAlert(null)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <SoapEditor
            soap={soap}
            onChange={editSection}
            readOnly={isStreaming}
            streaming={isStreaming}
            hasContent={hasContent}
          />
          {(hasContent || isStreaming) && grounding && (
            <GroundingPanel grounding={grounding} />
          )}
        </div>
      </div>

      {drawerOpen && (
        <VersionDrawer
          encounterId={id}
          currentSoap={soap}
          savedByName={user.fullName}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {conflict && (
        <ConfirmDialog
          title="Note updated elsewhere"
          body="This note has been updated since you loaded it. Reload to see the latest version before saving again."
          confirmLabel="Reload latest"
          tone="primary"
          onConfirm={reloadLatest}
          onCancel={() => setConflict(false)}
        />
      )}
    </div>
  );
}

function WorkspaceTopBar({ initials }: { initials: string }) {
  return (
    <header className="ws-topbar">
      <Link className="ws-back" href="/encounters">
        <ArrowLeft aria-hidden="true" /> Encounters
      </Link>
      <div className="brand">
        <span className="nm">Kyron Scribe</span>
      </div>
      <div className="right">
        <ThemeToggle />
        <div className="tb-avatar" aria-hidden="true">
          {initials}
        </div>
      </div>
    </header>
  );
}
