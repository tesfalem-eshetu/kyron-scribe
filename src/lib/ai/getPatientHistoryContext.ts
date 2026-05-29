import { prisma } from "@/lib/prisma";

export const NO_PATIENT_HISTORY_CONTEXT =
  "No prior saved encounters found for this provider and patient.";

// Backend-only retrieval of returning-patient context (master plan 8.3). The
// summary is strictly provider-scoped: a provider never receives another
// provider's summary. The frontend never assembles prior notes into the prompt.
export async function getPatientHistoryContext(
  patientId: string,
  providerId: string,
): Promise<string> {
  const summary = await prisma.patientContextSummary.findUnique({
    where: { patientId_providerId: { patientId, providerId } },
    select: { summaryText: true },
  });

  return summary?.summaryText ?? NO_PATIENT_HISTORY_CONTEXT;
}
