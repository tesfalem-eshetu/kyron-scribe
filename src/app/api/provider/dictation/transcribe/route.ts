import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse, validationError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { transcribeAudioFile } from "@/lib/ai/realtimeTranscription";

export const dynamic = "force-dynamic";

// OpenAI rejects audio uploads larger than 25 MB.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Recorded-audio fallback when live WebRTC dictation is unavailable.
// POST /api/provider/dictation/transcribe  (multipart/form-data, field "audio")
export async function POST(req: NextRequest) {
  try {
    const provider = await requireProvider();

    const form = await req.formData().catch(() => null);
    const file = form?.get("audio");

    if (!(file instanceof File)) {
      throw validationError("An audio file is required in the 'audio' field.");
    }
    if (file.size === 0) {
      throw validationError("The audio file is empty.");
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw validationError("The audio file exceeds the 25 MB limit.");
    }

    const text = await transcribeAudioFile(file);

    await writeAuditLog({
      userId: provider.id,
      action: "DICTATION_FALLBACK_USED",
      entityType: "DICTATION",
      metadata: { mode: "file", bytes: file.size },
    });

    return NextResponse.json({ text });
  } catch (error) {
    return toErrorResponse(error);
  }
}
