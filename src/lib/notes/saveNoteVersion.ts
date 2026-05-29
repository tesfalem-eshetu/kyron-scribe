import { prisma } from "@/lib/prisma";
import { notFound, versionConflict } from "@/lib/errors";

export interface SaveNoteVersionInput {
  encounterId: string;
  providerId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  saveReason?: string;
  // Optimistic concurrency: the version the editor was based on. If provided and
  // it no longer matches the latest persisted version, the save is rejected so a
  // concurrent edit is never silently overwritten.
  baseVersionNumber?: number;
}

export interface SaveNoteVersionResult {
  patientId: string;
  noteId: string;
  versionNumber: number;
  versionId: string;
  version: {
    id: string;
    versionNumber: number;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    fullText: string | null;
    saveReason: string | null;
    savedByUserId: string;
    createdAt: Date;
  };
}

function buildFullText(input: SaveNoteVersionInput): string {
  return [
    `Subjective:\n${input.subjective}`,
    `Objective:\n${input.objective}`,
    `Assessment:\n${input.assessment}`,
    `Plan:\n${input.plan}`,
  ].join("\n\n");
}

// Canonical transactional save (master plan Section 9.4, steps 1-9). Every call
// creates a new immutable NoteVersion; existing versions are never updated or
// deleted. The post-save PatientContextSummary gate (step 10 / Section 9.5) is a
// later phase and intentionally not invoked here.
export async function saveNoteVersion(
  input: SaveNoteVersionInput,
): Promise<SaveNoteVersionResult> {
  return prisma.$transaction(async (tx) => {
    const encounter = await tx.encounter.findFirst({
      where: { id: input.encounterId, providerId: input.providerId },
      select: {
        id: true,
        patientId: true,
        note: { select: { id: true } },
        draft: { select: { id: true } },
      },
    });
    if (!encounter) throw notFound("Encounter not found.");

    const note =
      encounter.note ??
      (await tx.note.create({ data: { encounterId: encounter.id } }));

    const latest = await tx.noteVersion.findFirst({
      where: { noteId: note.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const latestNumber = latest?.versionNumber ?? 0;

    if (
      input.baseVersionNumber !== undefined &&
      input.baseVersionNumber !== latestNumber
    ) {
      throw versionConflict(
        `Save is based on version ${input.baseVersionNumber} but the current version is ${latestNumber}.`,
      );
    }

    const nextVersionNumber = latestNumber + 1;

    const version = await tx.noteVersion.create({
      data: {
        noteId: note.id,
        versionNumber: nextVersionNumber,
        subjective: input.subjective,
        objective: input.objective,
        assessment: input.assessment,
        plan: input.plan,
        fullText: buildFullText(input),
        savedByUserId: input.providerId,
        saveReason: input.saveReason ?? null,
      },
    });

    await tx.note.update({
      where: { id: note.id },
      data: { currentVersionId: version.id },
    });

    await tx.encounter.update({
      where: { id: encounter.id },
      data: { status: "FINALIZED" },
    });

    if (encounter.draft) {
      await tx.encounterDraft.update({
        where: { id: encounter.draft.id },
        data: { status: "FINALIZED" },
      });
    }

    // Step 9: audit rows are part of the canonical transaction so a saved note
    // can never exist without its audit trail.
    await tx.auditLog.create({
      data: {
        userId: input.providerId,
        action: "NOTE_VERSION_CREATED",
        entityType: "NoteVersion",
        entityId: version.id,
        metadata: {
          encounterId: encounter.id,
          noteId: note.id,
          versionNumber: nextVersionNumber,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.providerId,
        action: "ENCOUNTER_FINALIZED",
        entityType: "Encounter",
        entityId: encounter.id,
        metadata: { noteVersionId: version.id, versionNumber: nextVersionNumber },
      },
    });

    return {
      patientId: encounter.patientId,
      noteId: note.id,
      versionNumber: nextVersionNumber,
      versionId: version.id,
      version,
    };
  });
}
