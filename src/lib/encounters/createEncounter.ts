import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/patients/normalizeName";

export interface CreateEncounterInput {
  providerId: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
  };
  transcript?: string | null;
  templateId?: string | null;
}

// Find-or-create the patient by normalized identity, then create the encounter
// and its 1:1 draft. Patient + encounter + draft are created in one transaction.
export async function createEncounter(input: CreateEncounterInput) {
  const normalizedFirstName = normalizeName(input.patient.firstName);
  const normalizedLastName = normalizeName(input.patient.lastName);

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.upsert({
      where: {
        normalizedFirstName_normalizedLastName_dateOfBirth: {
          normalizedFirstName,
          normalizedLastName,
          dateOfBirth: input.patient.dateOfBirth,
        },
      },
      update: {},
      create: {
        firstName: input.patient.firstName.trim(),
        lastName: input.patient.lastName.trim(),
        dateOfBirth: input.patient.dateOfBirth,
        normalizedFirstName,
        normalizedLastName,
      },
    });

    const encounter = await tx.encounter.create({
      data: {
        patientId: patient.id,
        providerId: input.providerId,
        templateId: input.templateId ?? null,
        transcript: input.transcript ?? null,
        status: "DRAFT",
        draft: {
          create: {
            providerId: input.providerId,
            transcript: input.transcript ?? null,
            selectedTemplateId: input.templateId ?? null,
            status: "IN_PROGRESS",
          },
        },
      },
      include: {
        patient: true,
        template: true,
        draft: true,
      },
    });

    return encounter;
  });
}
