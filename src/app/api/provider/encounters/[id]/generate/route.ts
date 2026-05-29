import { NextRequest } from "next/server";
import { z } from "zod";
import { requireProvider } from "@/lib/auth/guards";
import { extractClinicalProblems, generateSoapNoteStream } from "@/lib/ai/openaiProvider";
import { getGroundedIcd10Candidates } from "@/lib/ai/groundIcd10Candidates";
import { getPatientHistoryContext } from "@/lib/ai/getPatientHistoryContext";
import { INSUFFICIENT_CLINICAL_CONTENT_MESSAGE } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  insufficientClinicalContent,
  notFound,
  templateUnavailable,
  toErrorResponse,
  validationError,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const GenerateNoteSchema = z.object({
  transcript: z.string().optional(),
  templateId: z.string().uuid().optional(),
});

const MIN_TRANSCRIPT_CHARS = 20;
const MIN_TRANSCRIPT_WORDS = 4;

function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function assertTranscriptIsWorthSending(transcript: string) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (
    transcript.trim().length < MIN_TRANSCRIPT_CHARS ||
    words.length < MIN_TRANSCRIPT_WORDS
  ) {
    throw insufficientClinicalContent(
      "Transcript is too short to generate a clinical note.",
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid generation request.");
    }

    const encounter = await prisma.encounter.findFirst({
      where: { id, providerId: user.id },
      include: { patient: true, draft: true },
    });
    if (!encounter) throw notFound("Encounter not found.");

    const transcript =
      parsed.data.transcript?.trim() ??
      encounter.transcript?.trim() ??
      encounter.draft?.transcript?.trim() ??
      "";
    const templateId =
      parsed.data.templateId ??
      encounter.templateId ??
      encounter.draft?.selectedTemplateId ??
      "";

    if (!templateId) throw validationError("A template is required.");
    assertTranscriptIsWorthSending(transcript);

    const template = await prisma.template.findFirst({
      where: { id: templateId, isActive: true },
      select: { id: true, name: true, promptText: true },
    });
    if (!template) {
      await writeAuditLog({
        userId: user.id,
        action: "NOTE_GENERATION_BLOCKED_TEMPLATE_UNAVAILABLE",
        entityType: "Encounter",
        entityId: encounter.id,
        metadata: { templateId },
      });
      throw templateUnavailable("Selected template is unavailable.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.encounter.update({
        where: { id: encounter.id },
        data: {
          transcript,
          templateId,
          templateNameSnapshot: template.name,
          templatePromptSnapshot: template.promptText,
          status: "GENERATING",
        },
      });
      await tx.encounterDraft.updateMany({
        where: { encounterId: encounter.id },
        data: {
          transcript,
          selectedTemplateId: templateId,
          status: "IN_PROGRESS",
          lastSavedAt: new Date(),
        },
      });
    });

    const patientHistoryContext = await getPatientHistoryContext(
      encounter.patientId,
      user.id,
    );
    const problems = await extractClinicalProblems(transcript);
    const icd10Candidates = await getGroundedIcd10Candidates(problems);

    await writeAuditLog({
      userId: user.id,
      action: "NOTE_GENERATION_STARTED",
      entityType: "Encounter",
      entityId: encounter.id,
      metadata: {
        templateId,
        extractedProblemCount: problems.length,
        candidateCount: icd10Candidates.length,
      },
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullText = "";

        const enqueue = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        };

        try {
          enqueue("metadata", { problems, icd10Candidates });

          for await (const delta of generateSoapNoteStream({
            transcript,
            templateName: template.name,
            templatePrompt: template.promptText,
            patient: encounter.patient,
            patientHistoryContext,
            icd10Candidates,
          })) {
            fullText += delta;
            enqueue("token", delta);
          }

          const normalizedText = fullText.trimStart();
          const refused = normalizedText.startsWith(
            "[INSUFFICIENT_CLINICAL_CONTENT]",
          );
          if (
            refused &&
            normalizedText.trim() !== INSUFFICIENT_CLINICAL_CONTENT_MESSAGE
          ) {
            const missing = INSUFFICIENT_CLINICAL_CONTENT_MESSAGE.slice(
              normalizedText.length,
            );
            if (missing) {
              fullText += missing;
              enqueue("token", missing);
            }
          }
          await prisma.$transaction(async (tx) => {
            await tx.encounter.update({
              where: { id: encounter.id },
              data: { status: refused ? "ERROR" : "GENERATED" },
            });
            await tx.encounterDraft.updateMany({
              where: { encounterId: encounter.id },
              data: {
                status: refused ? "IN_PROGRESS" : "GENERATED",
                lastSavedAt: new Date(),
              },
            });
          });

          await writeAuditLog({
            userId: user.id,
            action: refused ? "NOTE_GENERATION_REFUSED" : "NOTE_GENERATION_COMPLETED",
            entityType: "Encounter",
            entityId: encounter.id,
            metadata: { refused },
          });

          enqueue("done", { ok: true, refused });
          controller.close();
        } catch (error) {
          console.error("SOAP generation stream failed:", error);
          await prisma.encounter.update({
            where: { id: encounter.id },
            data: { status: "ERROR" },
          });
          await writeAuditLog({
            userId: user.id,
            action: "NOTE_GENERATION_FAILED",
            entityType: "Encounter",
            entityId: encounter.id,
          });
          enqueue("error", { message: "SOAP generation failed." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
