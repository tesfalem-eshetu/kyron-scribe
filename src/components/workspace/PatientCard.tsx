"use client";

import type { PatientSummary } from "@/lib/client/types";
import { computeAge, formatDob } from "@/lib/client/format";

export function PatientCard({ patient }: { patient: PatientSummary }) {
  const age = computeAge(patient.dateOfBirth);
  return (
    <div className="card pi-card">
      <div className="panel-head">
        <h3>Patient</h3>
      </div>
      <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <div className="pi-row">
          <span className="k">Name</span>
          <span className="v">
            {patient.lastName}, {patient.firstName}
          </span>
        </div>
        <div className="pi-row">
          <span className="k">Date of birth</span>
          <span className="v">
            {formatDob(patient.dateOfBirth)}
            {age !== null ? ` · ${age}y` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
