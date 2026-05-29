import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

// Resolves the Note for an encounter the provider owns. A non-owned or missing
// encounter is indistinguishable (404, never 403 -- master plan 7.1). Returns
// null when the encounter exists but has no saved note yet.
async function resolveOwnedNoteId(
  encounterId: string,
  providerId: string,
): Promise<string | null> {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
    select: { note: { select: { id: true } } },
  });
  if (!encounter) throw notFound("Encounter not found.");
  return encounter.note?.id ?? null;
}

const VERSION_FIELDS = {
  id: true,
  versionNumber: true,
  subjective: true,
  objective: true,
  assessment: true,
  plan: true,
  fullText: true,
  saveReason: true,
  savedByUserId: true,
  createdAt: true,
} as const;

export async function getLatestNote(encounterId: string, providerId: string) {
  const noteId = await resolveOwnedNoteId(encounterId, providerId);
  if (!noteId) throw notFound("No saved note for this encounter.");

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      currentVersionId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!note) throw notFound("No saved note for this encounter.");

  const currentVersion = await prisma.noteVersion.findFirst({
    where: { noteId: note.id },
    orderBy: { versionNumber: "desc" },
    select: VERSION_FIELDS,
  });

  return { ...note, currentVersion };
}

export async function getNoteVersions(encounterId: string, providerId: string) {
  const noteId = await resolveOwnedNoteId(encounterId, providerId);
  if (!noteId) return { noteId: null, versions: [] };

  const versions = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { versionNumber: "desc" },
    select: VERSION_FIELDS,
  });

  return { noteId, versions };
}

export async function getNoteVersion(
  encounterId: string,
  providerId: string,
  versionId: string,
) {
  const noteId = await resolveOwnedNoteId(encounterId, providerId);
  if (!noteId) throw notFound("Note version not found.");

  const version = await prisma.noteVersion.findFirst({
    where: { id: versionId, noteId },
    select: VERSION_FIELDS,
  });
  if (!version) throw notFound("Note version not found.");

  return version;
}
