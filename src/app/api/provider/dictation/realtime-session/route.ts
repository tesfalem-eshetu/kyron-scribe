import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { createRealtimeTranscriptionSecret } from "@/lib/ai/realtimeTranscription";

export const dynamic = "force-dynamic";

// Mint a short-lived ephemeral token for browser WebRTC live dictation.
// POST /api/provider/dictation/realtime-session
export async function POST() {
  let providerId: string | null = null;
  try {
    const provider = await requireProvider();
    providerId = provider.id;

    const secret = await createRealtimeTranscriptionSecret(provider.id);

    await writeAuditLog({
      userId: provider.id,
      action: "DICTATION_SESSION_CREATED",
      entityType: "DICTATION",
      metadata: { mode: "realtime", model: secret.model },
    });

    return NextResponse.json({
      token: secret.token,
      expiresAt: secret.expiresAt,
      model: secret.model,
    });
  } catch (error) {
    if (providerId) {
      await writeAuditLog({
        userId: providerId,
        action: "DICTATION_SESSION_FAILED",
        entityType: "DICTATION",
        metadata: { mode: "realtime" },
      });
    }
    return toErrorResponse(error);
  }
}
