"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Plus, RotateCcw, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { SimpleBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddProviderModal } from "@/components/admin/AddProviderModal";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, isApiError } from "@/lib/client/api";
import { formatDob } from "@/lib/client/format";
import type { ProviderRosterItem } from "@/lib/client/types";

export default function AdminProvidersPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ProviderRosterItem | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { providers } = await apiFetch<{ providers: ProviderRosterItem[] }>(
        "/api/admin/providers",
      );
      setProviders(providers);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deactivate(p: ProviderRosterItem) {
    setBusyId(p.id);
    try {
      await apiFetch(`/api/admin/providers/${p.id}/deactivate`, {
        method: "PATCH",
      });
      setConfirmTarget(null);
      toast.push({ type: "info", message: `${p.fullName} deactivated` });
      await load();
    } catch (err) {
      toast.push({
        type: "error",
        message: isApiError(err) ? err.message : "Could not deactivate provider.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(p: ProviderRosterItem) {
    setBusyId(p.id);
    try {
      await apiFetch(`/api/admin/providers/${p.id}/reactivate`, {
        method: "PATCH",
      });
      toast.push({ type: "success", message: `${p.fullName} reactivated` });
      await load();
    } catch (err) {
      toast.push({
        type: "error",
        message: isApiError(err) ? err.message : "Could not reactivate provider.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell variant="admin" pageClassName="page-wide">
      <div className="page-head">
        <div>
          <h1>Providers</h1>
          <div className="sub">Manage the provider roster and access</div>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" /> Add Provider
        </Button>
      </div>

      {error && (
        <InlineAlert type="error" title="Could not load providers." className="mb-3">
          {error}
        </InlineAlert>
      )}

      <div className="table-wrap">
        {!loading && providers.length === 0 ? (
          <div className="tbl-empty">
            <div className="ring">
              <UserRoundCheck aria-hidden="true" />
            </div>
            <h3>No providers yet</h3>
            <p>Add your first provider to give them access to Kyron Scribe.</p>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" /> Add Provider
            </Button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th className="num">Encounters</th>
                  <th>Created</th>
                  <th className="act" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td>
                          <Skeleton width="60%" />
                        </td>
                        <td>
                          <Skeleton width="75%" />
                        </td>
                        <td>
                          <Skeleton width={72} height={18} radius={6} />
                        </td>
                        <td className="num">
                          <Skeleton width={24} />
                        </td>
                        <td>
                          <Skeleton width={80} />
                        </td>
                        <td className="act">
                          <Skeleton width={92} height={24} radius={6} />
                        </td>
                      </tr>
                    ))
                  : providers.map((p) => (
                      <tr
                        key={p.id}
                        className={p.status === "INACTIVE" ? "status-inactive" : ""}
                      >
                        <td className="pt-name">{p.fullName}</td>
                        <td>{p.email}</td>
                        <td>
                          <SimpleBadge
                            active={p.status === "ACTIVE"}
                            label={p.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"}
                          />
                        </td>
                        <td className="num">{p._count.encounters}</td>
                        <td className="tnum">{formatDob(p.createdAt)}</td>
                        <td className="act">
                          {p.status === "ACTIVE" ? (
                            <button
                              className="row-act danger"
                              disabled={busyId === p.id}
                              onClick={() => setConfirmTarget(p)}
                            >
                              <Lock aria-hidden="true" /> Deactivate
                            </button>
                          ) : (
                            <button
                              className="row-act"
                              disabled={busyId === p.id}
                              onClick={() => reactivate(p)}
                            >
                              <RotateCcw aria-hidden="true" /> Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <AddProviderModal onClose={() => setAddOpen(false)} onCreated={load} />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Deactivate provider?"
          body={`This signs ${confirmTarget.fullName} out everywhere and blocks access immediately. Their encounters are retained.`}
          confirmLabel="Deactivate"
          tone="danger"
          loading={busyId === confirmTarget.id}
          onConfirm={() => deactivate(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </AppShell>
  );
}
