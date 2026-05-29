import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProvider } from "@/lib/auth/guards";
import { saveNoteVersion } from "@/lib/notes/saveNoteVersion";
import { runPatientContextSummaryGate } from "@/lib/patients/runPatientContextSummaryGate";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { ApiError, toErrorResponse, validationError } from "@/lib/errors";

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
  let providerId: string | undefined;
  let encounterId: string | undefined;
  try {
    const user = await requireProvider();
    providerId = user.id;
    const { id } = await context.params;
    encounterId = id;

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

    // Step 10 (master plan 9.4 / 9.5): post-save summary gate. Runs after the
    // save transaction has committed and never throws, so it cannot roll back
    // the saved version.
    await runPatientContextSummaryGate({
      patientId: result.patientId,
      providerId: user.id,
      noteId: result.noteId,
      noteVersionId: result.versionId,
      versionNumber: result.versionNumber,
      currentSections: { subjective, objective, assessment, plan },
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
    // Audit save failures that occur after authentication (validation, version
    // conflict, ownership). Pre-auth failures have no provider to attribute.
    if (providerId && error instanceof ApiError) {
      await writeAuditLog({
        userId: providerId,
        action: "NOTE_SAVE_FAILED",
        entityType: "Encounter",
        entityId: encounterId,
        metadata: { code: error.code },
      });
    }
    return toErrorResponse(error);
  }
}
