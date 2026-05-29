import { prisma } from "@/lib/prisma";

export interface UpdatePatientContextSummaryInput {
  patientId: string;
  providerId: string;
  summaryText: string;
  sourceNoteVersionId: string;
  priorEncounterCount: number;
}

// Upsert the single provider-scoped summary for a patient (unique on
// patientId+providerId). This is derived AI context, not the legal record.
export async function updatePatientContextSummary(
  input: UpdatePatientContextSummaryInput,
) {
  return prisma.patientContextSummary.upsert({
    where: {
      patientId_providerId: {
        patientId: input.patientId,
        providerId: input.providerId,
      },
    },
    update: {
      summaryText: input.summaryText,
      sourceNoteVersionId: input.sourceNoteVersionId,
      priorEncounterCount: input.priorEncounterCount,
    },
    create: {
      patientId: input.patientId,
      providerId: input.providerId,
      summaryText: input.summaryText,
      sourceNoteVersionId: input.sourceNoteVersionId,
      priorEncounterCount: input.priorEncounterCount,
    },
  });
}
