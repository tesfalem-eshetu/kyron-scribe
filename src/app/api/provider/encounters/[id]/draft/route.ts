import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProvider } from "@/lib/auth/guards";
import { getEncounterDraft } from "@/lib/drafts/getEncounterDraft";
import { updateEncounterDraft } from "@/lib/drafts/updateEncounterDraft";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UpdateDraftSchema = z
  .object({
    transcript: z.string().nullable().optional(),
    selectedTemplateId: z.string().uuid().nullable().optional(),
    subjective: z.string().nullable().optional(),
    objective: z.string().nullable().optional(),
    assessment: z.string().nullable().optional(),
    plan: z.string().nullable().optional(),
    status: z.enum(["IN_PROGRESS", "GENERATED"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const draft = await getEncounterDraft(id, user.id);
    return NextResponse.json(draft);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("No valid draft fields to autosave.");
    }

    const draft = await updateEncounterDraft(id, user.id, parsed.data);
    return NextResponse.json({ draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}
