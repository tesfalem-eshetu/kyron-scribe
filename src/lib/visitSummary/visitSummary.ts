import { prisma } from "@/lib/prisma";
import { conflict, notFound, validationError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { generateVisitSummaryText } from "@/lib/ai/openaiProvider";
import type {
  PatientVisitSummary,
  PatientVisitSummaryStatus,
} from "@/generated/prisma/client";

// Patient-facing visit summary service (pioneer feature). One summary per
// encounter, generated from the encounter's latest finalized NoteVersion.
// Ownership is enforced on every call: a non-owned encounter is a 404, never
// a 403 (master plan 7.1).

export interface VisitSummaryDTO {
  id: string;
  status: PatientVisitSummaryStatus;
  summaryText: string;
  followUpText: string | null;
  noteVersionNumber: number | null;
  currentVersionNumber: number | null;
  stale: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface VisitSummaryState {
  hasFinalizedNote: boolean;
  summary: VisitSummaryDTO | null;
}

type SummaryWithVersion = PatientVisitSummary & {
  noteVersion: { versionNumber: number } | null;
};

async function loadOwnedEncounter(encounterId: string, providerId: string) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    select: {
      id: true,
      patientId: true,
      patient: { select: { firstName: true } },
      note: { select: { id: true, currentVersionId: true } },
    },
  });
  if (!encounter) throw notFound("Encounter not found.");
  return encounter;
}

async function serialize(
  summary: SummaryWithVersion,
  currentVersionId: string | null,
): Promise<VisitSummaryDTO> {
  let currentVersionNumber: number | null = null;
  if (currentVersionId) {
    const current = await prisma.noteVersion.findUnique({
      where: { id: currentVersionId },
      select: { versionNumber: true },
    });
    currentVersionNumber = current?.versionNumber ?? null;
  }

  return {
    id: summary.id,
    status: summary.status,
    summaryText: summary.summaryText,
    followUpText: summary.followUpText,
    noteVersionNumber: summary.noteVersion?.versionNumber ?? null,
    currentVersionNumber,
    // The summary is stale when the note has advanced past the version it was
    // generated from, so the provider can regenerate before publishing.
    stale: currentVersionId !== null && summary.noteVersionId !== currentVersionId,
    publishedAt: summary.publishedAt?.toISOString() ?? null,
    updatedAt: summary.updatedAt.toISOString(),
  };
}

export async function getVisitSummary(
  encounterId: string,
  providerId: string,
): Promise<VisitSummaryState> {
  const encounter = await loadOwnedEncounter(encounterId, providerId);
  const summary = await prisma.patientVisitSummary.findUnique({
    where: { encounterId },
    include: { noteVersion: { select: { versionNumber: true } } },
  });

  return {
    hasFinalizedNote: Boolean(encounter.note?.currentVersionId),
    summary: summary
      ? await serialize(summary, encounter.note?.currentVersionId ?? null)
      : null,
  };
}

export async function generateVisitSummary(
  encounterId: string,
  providerId: string,
): Promise<VisitSummaryDTO> {
  const encounter = await loadOwnedEncounter(encounterId, providerId);
  const currentVersionId = encounter.note?.currentVersionId ?? null;
  if (!currentVersionId) {
    throw conflict(
      "Finalize the SOAP note before generating a patient visit summary.",
    );
  }

  const version = await prisma.noteVersion.findUnique({
    where: { id: currentVersionId },
    select: {
      id: true,
      subjective: true,
      objective: true,
      assessment: true,
      plan: true,
    },
  });
  if (!version) {
    throw conflict(
      "Finalize the SOAP note before generating a patient visit summary.",
    );
  }

  const summaryText = await generateVisitSummaryText({
    patientFirstName: encounter.patient.firstName,
    note: {
      subjective: version.subjective,
      objective: version.objective,
      assessment: version.assessment,
      plan: version.plan,
    },
  });

  const existing = await prisma.patientVisitSummary.findUnique({
    where: { encounterId },
    select: { id: true },
  });

  const saved = await prisma.patientVisitSummary.upsert({
    where: { encounterId },
    create: {
      patientId: encounter.patientId,
      encounterId,
      providerId,
      noteVersionId: version.id,
      summaryText,
      status: "DRAFT",
    },
    update: {
      noteVersionId: version.id,
      summaryText,
      followUpText: null,
      status: "DRAFT",
      publishedAt: null,
    },
    include: { noteVersion: { select: { versionNumber: true } } },
  });

  await writeAuditLog({
    userId: providerId,
    action: existing
      ? "PATIENT_VISIT_SUMMARY_REGENERATED"
      : "PATIENT_VISIT_SUMMARY_GENERATED",
    entityType: "PatientVisitSummary",
    entityId: saved.id,
    metadata: {
      encounterId,
      patientId: encounter.patientId,
      noteVersionId: version.id,
    },
  });

  return serialize(saved, currentVersionId);
}

export async function updateVisitSummary(
  encounterId: string,
  providerId: string,
  input: { summaryText: string; followUpText?: string | null },
): Promise<VisitSummaryDTO> {
  const encounter = await loadOwnedEncounter(encounterId, providerId);
  const existing = await prisma.patientVisitSummary.findUnique({
    where: { encounterId },
    select: { id: true },
  });
  if (!existing) throw notFound("No patient visit summary to update.");

  const text = input.summaryText.trim();
  if (!text) throw validationError("Patient visit summary cannot be empty.");
  const followUp = input.followUpText?.trim() ? input.followUpText.trim() : null;

  const saved = await prisma.patientVisitSummary.update({
    where: { encounterId },
    // Editing returns a published summary to draft until it is re-published, so
    // published patient-facing content never changes silently.
    data: { summaryText: text, followUpText: followUp, status: "DRAFT" },
    include: { noteVersion: { select: { versionNumber: true } } },
  });

  await writeAuditLog({
    userId: providerId,
    action: "PATIENT_VISIT_SUMMARY_UPDATED",
    entityType: "PatientVisitSummary",
    entityId: saved.id,
    metadata: { encounterId, patientId: encounter.patientId },
  });

  return serialize(saved, encounter.note?.currentVersionId ?? null);
}

export async function discardVisitSummary(
  encounterId: string,
  providerId: string,
): Promise<void> {
  await loadOwnedEncounter(encounterId, providerId);
  const existing = await prisma.patientVisitSummary.findUnique({
    where: { encounterId },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.patientVisitSummary.delete({ where: { encounterId } });

  await writeAuditLog({
    userId: providerId,
    action: "PATIENT_VISIT_SUMMARY_DISCARDED",
    entityType: "PatientVisitSummary",
    entityId: existing.id,
    metadata: { encounterId },
  });
}

export async function publishVisitSummary(
  encounterId: string,
  providerId: string,
): Promise<VisitSummaryDTO> {
  const encounter = await loadOwnedEncounter(encounterId, providerId);
  const existing = await prisma.patientVisitSummary.findUnique({
    where: { encounterId },
    select: { id: true, summaryText: true },
  });
  if (!existing) throw notFound("No patient visit summary to publish.");
  if (!existing.summaryText.trim()) {
    throw validationError("Patient visit summary cannot be empty.");
  }

  const saved = await prisma.patientVisitSummary.update({
    where: { encounterId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: { noteVersion: { select: { versionNumber: true } } },
  });

  await writeAuditLog({
    userId: providerId,
    action: "PATIENT_VISIT_SUMMARY_PUBLISHED",
    entityType: "PatientVisitSummary",
    entityId: saved.id,
    metadata: { encounterId, patientId: encounter.patientId },
  });

  return serialize(saved, encounter.note?.currentVersionId ?? null);
}
