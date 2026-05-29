import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/auth/guards";
import { createEncounter } from "@/lib/encounters/createEncounter";
import { parseDateOfBirth } from "@/lib/patients/normalizeName";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateEncounterSchema = z.object({
  patient: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
  }),
  transcript: z.string().optional(),
  templateId: z.string().uuid().optional(),
});

const DraftStatusSchema = z.enum([
  "IN_PROGRESS",
  "GENERATED",
  "FINALIZED",
  "ABANDONED",
]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireProvider();

    const body = await req.json().catch(() => null);
    const parsed = CreateEncounterSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Patient first name, last name, and date of birth are required.");
    }

    const dateOfBirth = parseDateOfBirth(parsed.data.patient.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime())) {
      throw validationError("dateOfBirth is not a valid date.");
    }

    const encounter = await createEncounter({
      providerId: user.id,
      patient: {
        firstName: parsed.data.patient.firstName,
        lastName: parsed.data.patient.lastName,
        dateOfBirth,
      },
      transcript: parsed.data.transcript ?? null,
      templateId: parsed.data.templateId ?? null,
    });

    return NextResponse.json({ encounter }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireProvider();

    const draftStatusParam = req.nextUrl.searchParams.get("draftStatus");
    let draftStatus: z.infer<typeof DraftStatusSchema> | undefined;
    if (draftStatusParam) {
      const parsed = DraftStatusSchema.safeParse(draftStatusParam);
      if (!parsed.success) throw validationError("Invalid draftStatus filter.");
      draftStatus = parsed.data;
    }

    const encounters = await prisma.encounter.findMany({
      where: {
        providerId: user.id,
        ...(draftStatus ? { draft: { status: draftStatus } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
        },
        template: { select: { id: true, name: true } },
        draft: { select: { status: true, lastSavedAt: true } },
      },
    });

    return NextResponse.json({ encounters });
  } catch (error) {
    return toErrorResponse(error);
  }
}
