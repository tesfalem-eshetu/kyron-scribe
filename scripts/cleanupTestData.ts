import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/lib/db/pgPoolConfig";

// Removes test-junk patients and their encounters left behind by automated
// test scripts (testScenarios, testGenerateStream, the live E2E harness, etc.).
// Legitimate seed data (e.g. patient "Robert Returning") is preserved.
//
// Usage:
//   tsx scripts/cleanupTestData.ts            (dry run - lists matches only)
//   tsx scripts/cleanupTestData.ts --apply    (performs the deletion)

const adapter = new PrismaPg(pgPoolConfig(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

// Exact-match (case-insensitive) name tokens produced by the test harnesses.
const TEST_TOKENS = new Set([
  "tester",
  "scenario",
  "gate",
  "retest",
  "encounter",
  "encountert",
  "admin",
  "model",
  "stream",
  "guard",
  "test",
  "new",
  "one",
  "two",
  "three",
]);

function isTestName(firstName: string, lastName: string): boolean {
  if (/\d/.test(firstName) || /\d/.test(lastName)) return true;
  if (TEST_TOKENS.has(firstName.toLowerCase())) return true;
  if (TEST_TOKENS.has(lastName.toLowerCase())) return true;
  return false;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const patients = await prisma.patient.findMany({
    select: { id: true, firstName: true, lastName: true },
  });

  const targets = patients.filter((p) => isTestName(p.firstName, p.lastName));

  if (targets.length === 0) {
    console.log("No test-junk patients found. Nothing to do.");
    return;
  }

  console.log(`Matched ${targets.length} test patient(s):`);
  for (const p of targets) {
    console.log(`  - ${p.lastName}, ${p.firstName} (${p.id})`);
  }

  const patientIds = targets.map((p) => p.id);

  const encounters = await prisma.encounter.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true },
  });
  const encounterIds = encounters.map((e) => e.id);

  const notes = await prisma.note.findMany({
    where: { encounterId: { in: encounterIds } },
    select: { id: true },
  });
  const noteIds = notes.map((n) => n.id);

  console.log(
    `\nWill remove ${encounterIds.length} encounter(s) and ${noteIds.length} note(s) plus dependent rows.`,
  );

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.patientVisitSummary.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await tx.patientContextSummaryEvent.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await tx.patientContextSummary.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await tx.noteVersion.deleteMany({ where: { noteId: { in: noteIds } } });
    await tx.note.deleteMany({ where: { encounterId: { in: encounterIds } } });
    // EncounterDraft cascades with the encounter, but delete explicitly to be safe.
    await tx.encounterDraft.deleteMany({
      where: { encounterId: { in: encounterIds } },
    });
    await tx.encounter.deleteMany({ where: { id: { in: encounterIds } } });
    await tx.patient.deleteMany({ where: { id: { in: patientIds } } });
  });

  console.log("\nDeletion complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
