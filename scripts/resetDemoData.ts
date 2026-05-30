import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/lib/db/pgPoolConfig";

// Clean-slate reset for demos. Removes ALL clinical data (patients, encounters,
// drafts, notes, note versions, context summaries, visit summaries) and the
// audit log, while PRESERVING user accounts, note templates, and the ICD-10
// catalog (including its embeddings). Re-run `prisma db seed` afterward to
// restore the "Robert Returning" demo patient.
//
// Sessions are left untouched. This is NOT prisma migrate reset: the ICD-10
// embeddings are kept so search keeps working without a costly re-embed.
//
// Usage (run where DATABASE_URL points at the target DB):
//   tsx scripts/resetDemoData.ts            (dry run - shows row counts only)
//   tsx scripts/resetDemoData.ts --apply    (performs the deletion)

const adapter = new PrismaPg(pgPoolConfig(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

async function main() {
  const apply = process.argv.includes("--apply");

  const [
    patients,
    encounters,
    notes,
    noteVersions,
    drafts,
    contextSummaries,
    contextEvents,
    visitSummaries,
    auditLogs,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.encounter.count(),
    prisma.note.count(),
    prisma.noteVersion.count(),
    prisma.encounterDraft.count(),
    prisma.patientContextSummary.count(),
    prisma.patientContextSummaryEvent.count(),
    prisma.patientVisitSummary.count(),
    prisma.auditLog.count(),
  ]);

  console.log("Current rows to be removed:");
  console.log(`  patients:                 ${patients}`);
  console.log(`  encounters:               ${encounters}`);
  console.log(`  encounter drafts:         ${drafts}`);
  console.log(`  notes:                    ${notes}`);
  console.log(`  note versions:            ${noteVersions}`);
  console.log(`  patient context summary:  ${contextSummaries}`);
  console.log(`  context summary events:   ${contextEvents}`);
  console.log(`  patient visit summaries:  ${visitSummaries}`);
  console.log(`  audit logs:               ${auditLogs}`);

  const [users, templates, icd10] = await Promise.all([
    prisma.user.count(),
    prisma.template.count(),
    prisma.icd10Code.count(),
  ]);
  console.log("\nPreserved (not touched):");
  console.log(`  users:                    ${users}`);
  console.log(`  templates:                ${templates}`);
  console.log(`  ICD-10 codes:             ${icd10}`);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Detach current-version pointers so note versions can be deleted safely.
    await tx.note.updateMany({ data: { currentVersionId: null } });

    await tx.patientVisitSummary.deleteMany({});
    await tx.patientContextSummaryEvent.deleteMany({});
    await tx.patientContextSummary.deleteMany({});
    await tx.noteVersion.deleteMany({});
    await tx.note.deleteMany({});
    await tx.encounterDraft.deleteMany({});
    await tx.encounter.deleteMany({});
    await tx.patient.deleteMany({});
    await tx.auditLog.deleteMany({});
  });

  console.log("\nReset complete. Run `pnpm exec prisma db seed` to restore demo baseline.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
