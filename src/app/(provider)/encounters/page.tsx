"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Inbox, Check, Plus } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { NewEncounterModal } from "@/components/dashboard/NewEncounterModal";
import { apiFetch, isApiError } from "@/lib/client/api";
import {
  formatDob,
  patientDisplayName,
  relativeTime,
} from "@/lib/client/format";
import type { EncounterListItem, EncounterStatus } from "@/lib/client/types";

const IN_PROGRESS: ReadonlySet<EncounterStatus> = new Set([
  "DRAFT",
  "GENERATING",
  "GENERATED",
  "ERROR",
]);

type Filter = "inprogress" | "all";

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td>
            <Skeleton width="60%" />
          </td>
          <td>
            <Skeleton width={70} />
          </td>
          <td>
            <Skeleton width="75%" />
          </td>
          <td>
            <Skeleton width={84} height={18} radius={6} />
          </td>
          <td>
            <Skeleton width={52} />
          </td>
          <td className="chev-cell" />
        </tr>
      ))}
    </>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("inprogress");
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { encounters } = await apiFetch<{ encounters: EncounterListItem[] }>(
        "/api/provider/encounters",
      );
      setEncounters(encounters);
    } catch (error) {
      setLoadError(
        isApiError(error) ? error.message : "Failed to load encounters.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function open(id: string) {
    router.push(`/encounters/${id}`);
  }

  const inProgressCount = encounters.filter((e) =>
    IN_PROGRESS.has(e.status),
  ).length;
  const rows =
    filter === "inprogress"
      ? encounters.filter((e) => IN_PROGRESS.has(e.status))
      : encounters;

  const showEmptyAll = !loading && encounters.length === 0;
  const showEmptyFilter =
    !loading && encounters.length > 0 && rows.length === 0;

  return (
    <AppShell variant="provider">
      {loadError && (
        <InlineAlert type="error" title="Could not load encounters." className="mb-3">
          {loadError}
        </InlineAlert>
      )}

      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Filter encounters">
          <button
            role="tab"
            aria-selected={filter === "inprogress"}
            className={filter === "inprogress" ? "on" : ""}
            onClick={() => setFilter("inprogress")}
          >
            In progress
            {!loading && !showEmptyAll && (
              <span className="count">{inProgressCount}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={filter === "all"}
            className={filter === "all" ? "on" : ""}
            onClick={() => setFilter("all")}
          >
            All
            {!loading && !showEmptyAll && (
              <span className="count">{encounters.length}</span>
            )}
          </button>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus aria-hidden="true" /> New Encounter
        </Button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {showEmptyAll ? (
          <div className="empty">
            <div className="ring">
              <Inbox aria-hidden="true" />
            </div>
            <h3>No encounters yet</h3>
            <p>
              Create your first encounter to generate a structured SOAP note from
              a visit transcript.
            </p>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus aria-hidden="true" /> New Encounter
            </Button>
          </div>
        ) : showEmptyFilter ? (
          <div className="empty">
            <div className="ring">
              <Check aria-hidden="true" />
            </div>
            <h3>No drafts in progress</h3>
            <p>All caught up. Switch to “All” to see finalized notes.</p>
            <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
              View all encounters
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>DOB</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Last saved</th>
                  <th className="chev-cell" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  rows.map((e) => (
                    <tr
                      key={e.id}
                      className="row-link"
                      tabIndex={0}
                      onClick={() => open(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") open(e.id);
                      }}
                    >
                      <td className="pt-name">{patientDisplayName(e.patient)}</td>
                      <td className="tnum" style={{ color: "var(--text-secondary)" }}>
                        {formatDob(e.patient.dateOfBirth)}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {e.template?.name ?? "—"}
                      </td>
                      <td>
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="rel">
                        {relativeTime(e.draft?.lastSavedAt ?? null)}
                      </td>
                      <td className="chev-cell">
                        <ChevronRight aria-hidden="true" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <NewEncounterModal
          onClose={() => setModalOpen(false)}
          onCreated={(id) => {
            setModalOpen(false);
            open(id);
          }}
        />
      )}
    </AppShell>
  );
}
