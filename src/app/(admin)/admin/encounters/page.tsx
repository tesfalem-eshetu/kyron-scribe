"use client";

import { useCallback, useEffect, useState } from "react";
import { Table2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Drawer } from "@/components/ui/Drawer";
import { apiFetch, isApiError } from "@/lib/client/api";
import {
  formatDateTime,
  formatDob,
  patientDisplayName,
} from "@/lib/client/format";
import type {
  AdminEncounterItem,
  EncounterStatus,
  ProviderRosterItem,
} from "@/lib/client/types";

const STATUSES: EncounterStatus[] = [
  "DRAFT",
  "GENERATING",
  "GENERATED",
  "FINALIZED",
  "ERROR",
];

interface Filters {
  providerId: string;
  status: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: Filters = {
  providerId: "",
  status: "",
  startDate: "",
  endDate: "",
};

export default function AdminEncountersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [encounters, setEncounters] = useState<AdminEncounterItem[]>([]);
  const [providers, setProviders] = useState<ProviderRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminEncounterItem | null>(null);

  useEffect(() => {
    apiFetch<{ providers: ProviderRosterItem[] }>("/api/admin/providers")
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (filters.providerId) qs.set("providerId", filters.providerId);
    if (filters.status) qs.set("status", filters.status);
    if (filters.startDate) qs.set("startDate", filters.startDate);
    if (filters.endDate) qs.set("endDate", filters.endDate);
    try {
      const { encounters } = await apiFetch<{
        encounters: AdminEncounterItem[];
      }>(`/api/admin/encounters${qs.toString() ? `?${qs}` : ""}`);
      setEncounters(encounters);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load encounters.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters =
    filters.providerId || filters.status || filters.startDate || filters.endDate;

  return (
    <AppShell variant="admin" pageClassName="page-wide">
      <div className="page-head">
        <div>
          <h1>Encounters</h1>
          <div className="sub">All clinical encounters across providers</div>
        </div>
        <div className="sub">{!loading && `${encounters.length} total`}</div>
      </div>

      <div className="filters">
        <div className="f f-provider">
          <label htmlFor="f-provider">Provider</label>
          <SelectField
            id="f-provider"
            value={filters.providerId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, providerId: e.target.value }))
            }
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="f f-status">
          <label htmlFor="f-status">Status</label>
          <SelectField
            id="f-status"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="f f-date">
          <label htmlFor="f-start">From</label>
          <input
            id="f-start"
            type="date"
            className="input tnum"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
          />
        </div>
        <div className="f f-date">
          <label htmlFor="f-end">To</label>
          <input
            id="f-end"
            type="date"
            className="input tnum"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
          />
        </div>
        <div className="f-spacer" />
        {hasFilters && (
          <Button
            variant="ghost"
            className="clear"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <InlineAlert type="error" title="Could not load encounters." className="mb-3">
          {error}
        </InlineAlert>
      )}

      <div className="table-wrap">
        {!loading && encounters.length === 0 ? (
          <div className="tbl-empty">
            <div className="ring">
              <Table2 aria-hidden="true" />
            </div>
            <h3>No encounters found</h3>
            <p>
              {hasFilters
                ? "No encounters match the current filters."
                : "No encounters have been created yet."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>DOB</th>
                  <th>Provider</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="chev" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td>
                          <Skeleton width="60%" />
                        </td>
                        <td>
                          <Skeleton width={70} />
                        </td>
                        <td>
                          <Skeleton width="70%" />
                        </td>
                        <td>
                          <Skeleton width="60%" />
                        </td>
                        <td>
                          <Skeleton width={84} height={18} radius={6} />
                        </td>
                        <td>
                          <Skeleton width={90} />
                        </td>
                        <td className="chev" />
                      </tr>
                    ))
                  : encounters.map((e) => (
                      <tr
                        key={e.id}
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                        onClick={() => setDetail(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") setDetail(e);
                        }}
                      >
                        <td className="pt-name">
                          {patientDisplayName(e.patient)}
                        </td>
                        <td className="tnum">
                          {formatDob(e.patient.dateOfBirth)}
                        </td>
                        <td>{e.provider.fullName}</td>
                        <td>{e.template?.name ?? "—"}</td>
                        <td>
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="tnum">{formatDateTime(e.createdAt)}</td>
                        <td className="chev" aria-hidden="true">
                          ›
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <Drawer
          title="Encounter detail"
          ariaLabel="Encounter detail"
          onClose={() => setDetail(null)}
        >
          <div className="det-grid">
            <div>
              <div className="k">Patient</div>
              <div className="v">{patientDisplayName(detail.patient)}</div>
            </div>
            <div>
              <div className="k">Date of birth</div>
              <div className="v">{formatDob(detail.patient.dateOfBirth)}</div>
            </div>
            <div>
              <div className="k">Provider</div>
              <div className="v">{detail.provider.fullName}</div>
            </div>
            <div>
              <div className="k">Template</div>
              <div className="v">{detail.template?.name ?? "—"}</div>
            </div>
            <div>
              <div className="k">Status</div>
              <div className="v">
                <StatusBadge status={detail.status} />
              </div>
            </div>
            <div>
              <div className="k">Finalized note</div>
              <div className="v">
                {detail.note?.currentVersionId ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div className="k">Created</div>
              <div className="v">{formatDateTime(detail.createdAt)}</div>
            </div>
            <div>
              <div className="k">Updated</div>
              <div className="v">{formatDateTime(detail.updatedAt)}</div>
            </div>
          </div>
          <InlineAlert type="info" className="mt-3">
            Note content is private to the owning provider and is not shown in the
            admin view.
          </InlineAlert>
        </Drawer>
      )}
    </AppShell>
  );
}
