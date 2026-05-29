"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, FileText, Pencil, Plus, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { SimpleBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TemplateEditorDrawer } from "@/components/admin/TemplateEditorDrawer";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, isApiError } from "@/lib/client/api";
import { formatDateTime } from "@/lib/client/format";
import type { AdminTemplate } from "@/lib/client/types";

export default function AdminTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { templates } = await apiFetch<{ templates: AdminTemplate[] }>(
        "/api/admin/templates",
      );
      setTemplates(templates);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function archive(t: AdminTemplate) {
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/templates/${t.id}`, { method: "DELETE" });
      setArchiveTarget(null);
      toast.push({ type: "info", message: `"${t.name}" archived` });
      await load();
    } catch (err) {
      toast.push({
        type: "error",
        message: isApiError(err) ? err.message : "Could not archive template.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function restore(t: AdminTemplate) {
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/templates/${t.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
      toast.push({ type: "success", message: `"${t.name}" restored` });
      await load();
    } catch (err) {
      toast.push({
        type: "error",
        message: isApiError(err) ? err.message : "Could not restore template.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell variant="admin" pageClassName="page-wide">
      <div className="page-head">
        <div>
          <h1>Templates</h1>
          <div className="sub">
            Prompt templates available to providers when generating notes
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New Template
        </Button>
      </div>

      {error && (
        <InlineAlert type="error" title="Could not load templates." className="mb-3">
          {error}
        </InlineAlert>
      )}

      <div className="table-wrap">
        {!loading && templates.length === 0 ? (
          <div className="tbl-empty">
            <div className="ring">
              <FileText aria-hidden="true" />
            </div>
            <h3>No templates yet</h3>
            <p>Create a template so providers can generate structured notes.</p>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> New Template
            </Button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="act" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td>
                          <Skeleton width="50%" />
                        </td>
                        <td>
                          <Skeleton width="80%" />
                        </td>
                        <td>
                          <Skeleton width={64} height={18} radius={6} />
                        </td>
                        <td>
                          <Skeleton width={90} />
                        </td>
                        <td className="act">
                          <Skeleton width={110} height={24} radius={6} />
                        </td>
                      </tr>
                    ))
                  : templates.map((t) => (
                      <tr
                        key={t.id}
                        className={!t.isActive ? "status-inactive" : ""}
                      >
                        <td className="pt-name">{t.name}</td>
                        <td className="tpl-desc">{t.description ?? "—"}</td>
                        <td>
                          <SimpleBadge
                            active={t.isActive}
                            label={t.isActive ? "ACTIVE" : "ARCHIVED"}
                          />
                        </td>
                        <td className="tnum">{formatDateTime(t.updatedAt)}</td>
                        <td className="act">
                          <div className="act-group">
                            <button
                              className="row-act"
                              disabled={busyId === t.id}
                              onClick={() => setEditing(t)}
                            >
                              <Pencil aria-hidden="true" /> Edit
                            </button>
                            {t.isActive ? (
                              <button
                                className="row-act danger"
                                disabled={busyId === t.id}
                                onClick={() => setArchiveTarget(t)}
                              >
                                <Archive aria-hidden="true" /> Archive
                              </button>
                            ) : (
                              <button
                                className="row-act"
                                disabled={busyId === t.id}
                                onClick={() => restore(t)}
                              >
                                <RotateCcw aria-hidden="true" /> Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <TemplateEditorDrawer
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}

      {archiveTarget && (
        <ConfirmDialog
          title="Archive template?"
          body={`"${archiveTarget.name}" will be hidden from providers for new notes. Existing notes that used it are unaffected, and you can restore it later.`}
          confirmLabel="Archive"
          tone="danger"
          loading={busyId === archiveTarget.id}
          onConfirm={() => archive(archiveTarget)}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
    </AppShell>
  );
}
