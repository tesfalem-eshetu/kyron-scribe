import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/lib/db/pgPoolConfig";

const baseUrl = process.env.KYRON_BASE_URL ?? "http://localhost:3000";

const adapter = new PrismaPg(pgPoolConfig(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

const RETURNING_PATIENT_ID = "a0000000-0000-4000-8000-000000000001";

function getCookie(headers: Headers): string {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not return a session cookie.");
  return setCookie.split(";")[0];
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email} failed: HTTP ${res.status}`);
  return getCookie(res.headers);
}

async function postJson<T>(
  path: string,
  cookie: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok: ${message}`);
}

const SECTIONS_V1 = {
  subjective:
    "Patient reports a productive cough and low-grade fever for three days, with mild wheezing.",
  objective: "Temp 38.1C. Scattered wheezes on auscultation. SpO2 97%.",
  assessment: "Acute bronchitis, likely viral.",
  plan: "Supportive care, hydration, albuterol inhaler PRN. Return if symptoms worsen.",
};

async function main() {
  console.log(`Base URL: ${baseUrl}\n`);

  const smith = await login("dr.smith@example.com", "password123");

  const smithUser = await prisma.user.findUnique({
    where: { email: "dr.smith@example.com" },
    select: { id: true },
  });
  const leeUser = await prisma.user.findUnique({
    where: { email: "dr.lee@example.com" },
    select: { id: true },
  });
  if (!smithUser || !leeUser) throw new Error("Seed users missing.");

  const templates = await fetch(`${baseUrl}/api/provider/templates`, {
    headers: { Cookie: smith },
  }).then((r) => r.json());
  const templateId = templates.templates?.[0]?.id;
  if (!templateId) throw new Error("No active template.");

  const created = await postJson<{ encounter: { id: string; patientId: string } }>(
    "/api/provider/encounters",
    smith,
    {
      patient: {
        firstName: "Context",
        lastName: `Tester${Date.now()}`,
        dateOfBirth: "1972-11-05",
      },
      transcript: "Productive cough and fever for three days.",
      templateId,
    },
  );
  const { id: encounterId, patientId } = created.encounter;
  console.log(`Encounter: ${encounterId}  Patient: ${patientId}\n`);

  console.log("1. First finalized save creates a context summary (UPDATED)");
  await postJson(`/api/provider/encounters/${encounterId}/save-note`, smith, SECTIONS_V1);

  const summary = await prisma.patientContextSummary.findUnique({
    where: { patientId_providerId: { patientId, providerId: smithUser.id } },
    select: { summaryText: true, priorEncounterCount: true, updatedAt: true },
  });
  assert(summary !== null, "summary exists for (patient, Dr. Smith)");
  assert((summary?.summaryText.trim().length ?? 0) > 0, "summary text is non-empty");

  const firstEvent = await prisma.patientContextSummaryEvent.findFirst({
    where: { patientId, providerId: smithUser.id },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  assert(firstEvent?.action === "UPDATED", "first save logged an UPDATED event");
  const summaryUpdatedAt = summary?.updatedAt.getTime() ?? 0;

  console.log("2. Identical re-save is skipped (deterministic, no summary change)");
  await postJson(`/api/provider/encounters/${encounterId}/save-note`, smith, {
    ...SECTIONS_V1,
    baseVersionNumber: 1,
  });

  const skipEvent = await prisma.patientContextSummaryEvent.findFirst({
    where: { patientId, providerId: smithUser.id },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  assert(
    skipEvent?.action === "SKIPPED_NOT_MEANINGFUL",
    "identical re-save logged SKIPPED_NOT_MEANINGFUL",
  );

  const summaryAfter = await prisma.patientContextSummary.findUnique({
    where: { patientId_providerId: { patientId, providerId: smithUser.id } },
    select: { updatedAt: true },
  });
  assert(
    summaryAfter?.updatedAt.getTime() === summaryUpdatedAt,
    "summary was not modified on skip",
  );

  console.log("3. Provider isolation: Dr. Lee has no summary for this patient");
  const leeSummary = await prisma.patientContextSummary.findUnique({
    where: { patientId_providerId: { patientId, providerId: leeUser.id } },
    select: { id: true },
  });
  assert(leeSummary === null, "no summary for (patient, Dr. Lee)");

  console.log("4. Seeded returning patient has prior context under Dr. Smith");
  const returning = await prisma.patientContextSummary.findUnique({
    where: {
      patientId_providerId: {
        patientId: RETURNING_PATIENT_ID,
        providerId: smithUser.id,
      },
    },
    select: { summaryText: true },
  });
  assert(returning !== null, "returning-patient summary exists");
  assert(
    /diabetes/i.test(returning?.summaryText ?? ""),
    "returning-patient summary references prior care",
  );

  console.log("\nAll patient-context gates passed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
