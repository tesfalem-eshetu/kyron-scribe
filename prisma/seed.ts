import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { icd10Seed } from "../src/data/icd10Seed";
import { buildSearchableText } from "../src/lib/icd/buildSearchableText";
import { pgPoolConfig } from "../src/lib/db/pgPoolConfig";
import { normalizeName, parseDateOfBirth } from "../src/lib/patients/normalizeName";

const BCRYPT_COST_FACTOR = 12;

const adapter = new PrismaPg(pgPoolConfig(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    email: "dr.smith@example.com",
    fullName: "Dr. Smith",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "dr.lee@example.com",
    fullName: "Dr. Lee",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "dr.johnson@example.com",
    fullName: "Dr. Johnson",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "admin@example.com",
    fullName: "System Admin",
    role: "ADMIN" as const,
    password: "admin123",
  },
];

const demoTemplates = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "General SOAP Note",
    description: "Standard SOAP note for a general clinical visit.",
    promptText:
      "You are an experienced clinician documenting a patient encounter. Using the visit transcript and clinical observations, produce a clear, concise SOAP note. Subjective: the patient's reported symptoms, history of present illness, and relevant context. Objective: examination findings, vital signs, and measurable data mentioned. Assessment: clinical impressions and differential considerations. Plan: diagnostics, treatments, medications, patient education, and follow-up. Use professional medical language. Only include information supported by the transcript; never fabricate findings.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Urgent Care Visit",
    description: "Focused SOAP note for an acute, episodic urgent care visit.",
    promptText:
      "You are a clinician documenting an urgent care visit. Generate a focused SOAP note emphasizing the acute presenting complaint. Subjective: chief complaint, onset, severity, and pertinent positives and negatives. Objective: targeted exam findings and vitals. Assessment: the most likely acute diagnosis and red-flag considerations. Plan: immediate management, prescriptions, return precautions, and follow-up timeframe. Be concise and action-oriented. Only document what the transcript supports.",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Orthopedic Follow-Up",
    description: "SOAP note for an orthopedic follow-up or recheck visit.",
    promptText:
      "You are an orthopedic clinician documenting a follow-up visit. Produce a SOAP note focused on the musculoskeletal complaint and interval change. Subjective: progress since last visit, pain levels, functional status, and adherence to prior plan. Objective: inspection, range of motion, strength, special tests, and imaging results if mentioned. Assessment: current status of the orthopedic condition and healing trajectory. Plan: activity modification, physical therapy, medication, imaging, and next follow-up. Only include details supported by the transcript.",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "New Patient Evaluation",
    description: "Comprehensive SOAP note for a new patient intake.",
    promptText:
      "You are a clinician conducting a comprehensive new patient evaluation. Generate a thorough SOAP note. Subjective: presenting concerns, complete history of present illness, past medical and surgical history, medications, allergies, family and social history as available. Objective: full examination findings and vitals. Assessment: a problem list with clinical reasoning. Plan: a per-problem plan including diagnostics, treatment, referrals, preventive care, and follow-up. Use professional medical language and only document information present in the transcript.",
  },
];

// Fixed IDs make the returning-patient seed idempotent across reseeds.
const RETURNING_PATIENT = {
  patientId: "a0000000-0000-4000-8000-000000000001",
  encounterId: "a0000000-0000-4000-8000-000000000002",
  noteId: "a0000000-0000-4000-8000-000000000003",
  noteVersionId: "a0000000-0000-4000-8000-000000000004",
  firstName: "Robert",
  lastName: "Returning",
  dateOfBirth: "1968-03-12",
  templateId: "11111111-1111-4111-8111-111111111111",
};

// Seeds a returning patient with a finalized note and a provider-scoped context
// summary under Dr. Smith so returning-patient context injection is demonstrable
// without calling OpenAI at seed time (master plan 12 / 8.3). The summaryText is
// curated, not AI-generated here.
async function seedReturningPatient(smithId: string | undefined) {
  if (!smithId) {
    console.log("Skipped returning patient (Dr. Smith not found).");
    return;
  }

  const dateOfBirth = parseDateOfBirth(RETURNING_PATIENT.dateOfBirth);

  await prisma.patient.upsert({
    where: { id: RETURNING_PATIENT.patientId },
    update: {},
    create: {
      id: RETURNING_PATIENT.patientId,
      firstName: RETURNING_PATIENT.firstName,
      lastName: RETURNING_PATIENT.lastName,
      dateOfBirth,
      normalizedFirstName: normalizeName(RETURNING_PATIENT.firstName),
      normalizedLastName: normalizeName(RETURNING_PATIENT.lastName),
    },
  });

  await prisma.encounter.upsert({
    where: { id: RETURNING_PATIENT.encounterId },
    update: { status: "FINALIZED" },
    create: {
      id: RETURNING_PATIENT.encounterId,
      patientId: RETURNING_PATIENT.patientId,
      providerId: smithId,
      templateId: RETURNING_PATIENT.templateId,
      status: "FINALIZED",
      transcript:
        "Follow-up for type 2 diabetes. Reports good adherence to metformin. No hypoglycemia. Mild seasonal allergies.",
    },
  });

  await prisma.note.upsert({
    where: { id: RETURNING_PATIENT.noteId },
    update: { currentVersionId: RETURNING_PATIENT.noteVersionId },
    create: {
      id: RETURNING_PATIENT.noteId,
      encounterId: RETURNING_PATIENT.encounterId,
      currentVersionId: RETURNING_PATIENT.noteVersionId,
    },
  });

  await prisma.noteVersion.upsert({
    where: { id: RETURNING_PATIENT.noteVersionId },
    update: {},
    create: {
      id: RETURNING_PATIENT.noteVersionId,
      noteId: RETURNING_PATIENT.noteId,
      versionNumber: 1,
      subjective:
        "Type 2 diabetes follow-up. Reports good adherence to metformin and no hypoglycemic episodes. Mild seasonal allergic rhinitis.",
      objective:
        "Vitals stable. No acute distress. Last A1c mildly elevated at 7.4%.",
      assessment:
        "Type 2 diabetes mellitus, reasonably controlled. Seasonal allergic rhinitis.",
      plan: "Continue metformin. Reinforce diet and exercise. Recheck A1c in 3 months. PRN antihistamine for allergies.",
      savedByUserId: smithId,
      saveReason: "Seed: prior finalized encounter.",
    },
  });

  await prisma.patientContextSummary.upsert({
    where: {
      patientId_providerId: {
        patientId: RETURNING_PATIENT.patientId,
        providerId: smithId,
      },
    },
    update: {},
    create: {
      patientId: RETURNING_PATIENT.patientId,
      providerId: smithId,
      summaryText:
        "Returning patient with type 2 diabetes mellitus managed on metformin; most recent A1c mildly elevated at 7.4% with good medication adherence and no hypoglycemia. History of seasonal allergic rhinitis. No known drug allergies.",
      sourceNoteVersionId: RETURNING_PATIENT.noteVersionId,
      priorEncounterCount: 1,
    },
  });

  console.log("Seeded returning patient: Robert Returning (under Dr. Smith)");
}

async function main() {
  let adminId: string | undefined;
  const providerIdByEmail = new Map<string, string>();

  for (const user of demoUsers) {
    const email = user.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_COST_FACTOR);

    const saved = await prisma.user.upsert({
      where: { email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
    });

    if (saved.role === "ADMIN") adminId = saved.id;
    if (saved.role === "PROVIDER") providerIdByEmail.set(email, saved.id);
    console.log(`Seeded ${user.role}: ${email}`);
  }

  for (const template of demoTemplates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        description: template.description,
        promptText: template.promptText,
        isActive: true,
        updatedById: adminId,
      },
      create: {
        id: template.id,
        name: template.name,
        description: template.description,
        promptText: template.promptText,
        isActive: true,
        createdById: adminId,
        updatedById: adminId,
      },
    });

    console.log(`Seeded template: ${template.name}`);
  }

  await seedReturningPatient(providerIdByEmail.get("dr.smith@example.com"));

  // ICD-10 catalog. Embeddings are generated separately (one-time, needs an
  // OpenAI key); this step is fully offline and only populates the rows.
  for (const entry of icd10Seed) {
    const searchableText = buildSearchableText(entry);
    await prisma.icd10Code.upsert({
      where: { code: entry.code },
      update: {
        description: entry.description,
        category: entry.category,
        synonyms: entry.synonyms,
        searchableText,
        isActive: true,
      },
      create: {
        code: entry.code,
        description: entry.description,
        category: entry.category,
        synonyms: entry.synonyms,
        searchableText,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${icd10Seed.length} ICD-10 codes`);
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
