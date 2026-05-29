import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const BCRYPT_COST_FACTOR = 12;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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

async function main() {
  let adminId: string | undefined;

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
