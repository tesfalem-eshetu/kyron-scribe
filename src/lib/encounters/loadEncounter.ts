import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

// Loads the full workspace state for an encounter the provider owns.
// Uses findFirst with providerId so a non-owned id is indistinguishable from
// a missing one (404, never 403 -- master plan 7.1).
export async function loadEncounter(encounterId: string, providerId: string) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    include: {
      patient: true,
      template: true,
      draft: true,
      note: true,
    },
  });

  if (!encounter) throw notFound("Encounter not found.");
  return encounter;
}
