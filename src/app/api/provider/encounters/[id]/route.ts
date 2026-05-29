import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProvider } from "@/lib/auth/guards";
import { loadEncounter } from "@/lib/encounters/loadEncounter";
import { updateEncounter } from "@/lib/encounters/updateEncounter";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UpdateEncounterSchema = z
  .object({
    transcript: z.string().nullable().optional(),
    templateId: z.string().uuid().nullable().optional(),
    status: z
      .enum(["DRAFT", "GENERATING", "GENERATED", "FINALIZED", "ERROR"])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const encounter = await loadEncounter(id, user.id);
    return NextResponse.json({ encounter });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateEncounterSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("No valid fields to update.");
    }

    const encounter = await updateEncounter(id, user.id, parsed.data);
    return NextResponse.json({ encounter });
  } catch (error) {
    return toErrorResponse(error);
  }
}
