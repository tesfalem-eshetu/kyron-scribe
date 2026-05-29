import type { EncounterStatus } from "@/lib/client/types";

const MAP: Record<EncounterStatus, { cls: string; label: string }> = {
  DRAFT: { cls: "badge-draft", label: "DRAFT" },
  GENERATING: { cls: "badge-generating", label: "GENERATING" },
  GENERATED: { cls: "badge-generated", label: "GENERATED" },
  FINALIZED: { cls: "badge-finalized", label: "FINALIZED" },
  ERROR: { cls: "badge-error", label: "ERROR" },
};

export function StatusBadge({ status }: { status: EncounterStatus }) {
  const m = MAP[status] ?? MAP.DRAFT;
  return (
    <span className={`badge ${m.cls}`}>
      <span className="dot" aria-hidden="true" />
      {m.label}
    </span>
  );
}

export function SimpleBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`badge ${active ? "badge-finalized" : "badge-draft"}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
