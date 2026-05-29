import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

// Restore-on-load workspace state for an owned encounter (master plan 9.7).
// Hydrates patient, selected template, transcript, SOAP sections, draft status
// and lastSavedAt. Ownership is enforced via findFirst({ id, providerId }) so a
// non-owned or missing id yields 404 (never 403, master plan 7.1).
export async function getEncounterDraft(encounterId: string, providerId: string) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    select: {
      id: true,
      status: true,
      patient: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
      },
      template: { select: { id: true, name: true } },
      draft: {
        select: {
          transcript: true,
          selectedTemplateId: true,
          subjective: true,
          objective: true,
          assessment: true,
          plan: true,
          status: true,
          lastSavedAt: true,
        },
      },
    },
  });

  if (!encounter || !encounter.draft) throw notFound("Encounter not found.");

  return {
    encounterId: encounter.id,
    encounterStatus: encounter.status,
    patient: encounter.patient,
    template: encounter.template,
    draft: encounter.draft,
  };
}
