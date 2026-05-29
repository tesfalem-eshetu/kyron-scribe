import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { EncounterStatus } from "@/generated/prisma/client";

export interface UpdateEncounterInput {
  transcript?: string | null;
  templateId?: string | null;
  status?: EncounterStatus;
}

// Updates transcript/template/status on an owned encounter and mirrors the
// transcript + selected template onto the 1:1 draft. Ownership enforced; a
// non-owned or missing id yields 404.
export async function updateEncounter(
  encounterId: string,
  providerId: string,
  input: UpdateEncounterInput,
) {
  const owned = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    select: { id: true },
  });
  if (!owned) throw notFound("Encounter not found.");

  return prisma.$transaction(async (tx) => {
    const draftData: { transcript?: string | null; selectedTemplateId?: string | null } = {};
    if (input.transcript !== undefined) draftData.transcript = input.transcript;
    if (input.templateId !== undefined) draftData.selectedTemplateId = input.templateId;

    if (Object.keys(draftData).length > 0) {
      await tx.encounterDraft.updateMany({
        where: { encounterId },
        data: draftData,
      });
    }

    // Read the encounter (with the now-updated draft) last so the response is fresh.
    return tx.encounter.update({
      where: { id: encounterId },
      data: {
        ...(input.transcript !== undefined ? { transcript: input.transcript } : {}),
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { patient: true, template: true, draft: true, note: true },
    });
  });
}
