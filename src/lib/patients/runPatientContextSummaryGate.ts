import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  classifyClinicalChangeSignificance,
  generatePatientContextSummary,
} from "@/lib/ai/openaiProvider";
import { updatePatientContextSummary } from "./updatePatientContextSummary";
import type { NoteSections } from "@/lib/ai/types";

export interface PatientContextSummaryGateInput {
  patientId: string;
  providerId: string;
  noteId: string;
  noteVersionId: string;
  versionNumber: number;
  currentSections: NoteSections;
}

function combineSections(sections: NoteSections): string {
  return [
    sections.subjective,
    sections.objective,
    sections.assessment,
    sections.plan,
  ].join("\n\n");
}

// Deterministic comparison: lowercase, trim, collapse whitespace.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Post-save PatientContextSummary update gate (master plan Section 9.5). Runs
// AFTER the save transaction has committed, so any failure here can never roll
// back the saved NoteVersion. Every outcome writes a PatientContextSummaryEvent
// and a matching AuditLog. This function never throws.
export async function runPatientContextSummaryGate(
  input: PatientContextSummaryGateInput,
): Promise<void> {
  try {
    const previous =
      input.versionNumber > 1
        ? await prisma.noteVersion.findFirst({
            where: {
              noteId: input.noteId,
              versionNumber: input.versionNumber - 1,
            },
            select: {
              subjective: true,
              objective: true,
              assessment: true,
              plan: true,
            },
          })
        : null;

    let meaningful: boolean;
    let reason: string;

    if (!previous) {
      meaningful = true;
      reason = "First finalized note for this patient and provider.";
    } else {
      const previousText = combineSections(previous);
      const currentText = combineSections(input.currentSections);
      if (normalize(previousText) === normalize(currentText)) {
        meaningful = false;
        reason = "No textual change from the previous version.";
      } else {
        const classification = await classifyClinicalChangeSignificance(
          previousText,
          currentText,
        );
        meaningful = classification.shouldUpdateSummary;
        reason = classification.reason;
      }
    }

    if (meaningful) {
      const priorEncounterCount = await prisma.encounter.count({
        where: {
          patientId: input.patientId,
          providerId: input.providerId,
          status: "FINALIZED",
        },
      });

      const [patient, priorSummary] = await Promise.all([
        prisma.patient.findUnique({
          where: { id: input.patientId },
          select: { firstName: true, lastName: true, dateOfBirth: true },
        }),
        prisma.patientContextSummary.findUnique({
          where: {
            patientId_providerId: {
              patientId: input.patientId,
              providerId: input.providerId,
            },
          },
          select: { summaryText: true },
        }),
      ]);

      const patientName = patient
        ? `${patient.firstName} ${patient.lastName}, DOB ${patient.dateOfBirth
            .toISOString()
            .slice(0, 10)}`
        : "Unknown patient";

      const summaryText = await generatePatientContextSummary({
        patientName,
        currentNote: input.currentSections,
        priorSummary: priorSummary?.summaryText ?? null,
        priorEncounterCount,
      });

      await updatePatientContextSummary({
        patientId: input.patientId,
        providerId: input.providerId,
        summaryText,
        sourceNoteVersionId: input.noteVersionId,
        priorEncounterCount,
      });

      await prisma.patientContextSummaryEvent.create({
        data: {
          patientId: input.patientId,
          providerId: input.providerId,
          noteVersionId: input.noteVersionId,
          action: "UPDATED",
          reason,
        },
      });

      await writeAuditLog({
        userId: input.providerId,
        action: "PATIENT_CONTEXT_SUMMARY_UPDATED",
        entityType: "PatientContextSummary",
        entityId: input.patientId,
        metadata: { noteVersionId: input.noteVersionId, reason },
      });
      return;
    }

    await prisma.patientContextSummaryEvent.create({
      data: {
        patientId: input.patientId,
        providerId: input.providerId,
        noteVersionId: input.noteVersionId,
        action: "SKIPPED_NOT_MEANINGFUL",
        reason,
      },
    });

    await writeAuditLog({
      userId: input.providerId,
      action: "PATIENT_CONTEXT_SUMMARY_UPDATE_SKIPPED",
      entityType: "PatientContextSummary",
      entityId: input.patientId,
      metadata: { noteVersionId: input.noteVersionId, reason },
    });
  } catch (error) {
    console.error("PatientContextSummary gate failed:", error);
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await prisma.patientContextSummaryEvent.create({
        data: {
          patientId: input.patientId,
          providerId: input.providerId,
          noteVersionId: input.noteVersionId,
          action: "FAILED",
          reason,
        },
      });
      await writeAuditLog({
        userId: input.providerId,
        action: "PATIENT_CONTEXT_SUMMARY_UPDATE_FAILED",
        entityType: "PatientContextSummary",
        entityId: input.patientId,
        metadata: { noteVersionId: input.noteVersionId, reason },
      });
    } catch (innerError) {
      console.error("Failed to record PatientContextSummary failure:", innerError);
    }
  }
}
