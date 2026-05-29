import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProvider } from "@/lib/auth/guards";
import { saveNoteVersion } from "@/lib/notes/saveNoteVersion";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SaveNoteSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  saveReason: z.string().trim().max(500).optional(),
  baseVersionNumber: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = SaveNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("All four SOAP sections are required.");
    }

    const subjective = parsed.data.subjective.trim();
    const objective = parsed.data.objective.trim();
    const assessment = parsed.data.assessment.trim();
    const plan = parsed.data.plan.trim();

    if (!subjective && !objective && !assessment && !plan) {
      throw validationError("A note must contain content in at least one section.");
    }

    const result = await saveNoteVersion({
      encounterId: id,
      providerId: user.id,
      subjective,
      objective,
      assessment,
      plan,
      saveReason: parsed.data.saveReason || undefined,
      baseVersionNumber: parsed.data.baseVersionNumber,
    });

    return NextResponse.json(
      {
        noteId: result.noteId,
        versionNumber: result.versionNumber,
        version: result.version,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
