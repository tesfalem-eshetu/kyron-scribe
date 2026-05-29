import { prisma } from "@/lib/prisma";
import { notFound, draftFinalized } from "@/lib/errors";
import type { DraftStatus } from "@/generated/prisma/client";

export interface UpdateEncounterDraftInput {
  transcript?: string | null;
  selectedTemplateId?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  // Autosave only advances the in-progress lifecycle (e.g. GENERATED after a
  // stream completes). FINALIZED is reached exclusively through save-note.
  status?: Extract<DraftStatus, "IN_PROGRESS" | "GENERATED">;
}

// Debounced autosave of the workspace draft (master plan 9.7). Last-write-wins,
// no conflict resolution in MVP. After finalization autosave is rejected with
// 409 DRAFT_FINALIZED -- Encounter.status is the authoritative gate (Section 14,
// conflict 5). transcript/selectedTemplateId are mirrored to the Encounter so the
// generation snapshot stays consistent with the draft.
export async function updateEncounterDraft(
  encounterId: string,
  providerId: string,
  input: UpdateEncounterDraftInput,
) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    select: { id: true, status: true },
  });
  if (!encounter) throw notFound("Encounter not found.");
  if (encounter.status === "FINALIZED") throw draftFinalized();

  const draftData: Record<string, unknown> = { lastSavedAt: new Date() };
  if (input.transcript !== undefined) draftData.transcript = input.transcript;
  if (input.selectedTemplateId !== undefined)
    draftData.selectedTemplateId = input.selectedTemplateId;
  if (input.subjective !== undefined) draftData.subjective = input.subjective;
  if (input.objective !== undefined) draftData.objective = input.objective;
  if (input.assessment !== undefined) draftData.assessment = input.assessment;
  if (input.plan !== undefined) draftData.plan = input.plan;
  if (input.status !== undefined) draftData.status = input.status;

  return prisma.$transaction(async (tx) => {
    const encounterData: Record<string, unknown> = {};
    if (input.transcript !== undefined) encounterData.transcript = input.transcript;
    if (input.selectedTemplateId !== undefined)
      encounterData.templateId = input.selectedTemplateId;

    if (Object.keys(encounterData).length > 0) {
      await tx.encounter.update({
        where: { id: encounterId },
        data: encounterData,
      });
    }

    const draft = await tx.encounterDraft.update({
      where: { encounterId },
      data: draftData,
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
    });

    return draft;
  });
}
