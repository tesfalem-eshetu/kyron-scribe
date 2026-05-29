import { getOpenAIClient } from "./openaiClient";
import { env } from "../env";

// Server-only: this module reads OPENAI_API_KEY (via the standard key) to mint
// short-lived browser tokens and to transcribe uploaded audio. It must never be
// imported into a client component.

const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

export interface RealtimeTranscriptionSecret {
  // Short-lived ephemeral token the browser uses as the WebRTC bearer. It is
  // NOT the standard API key and expires in ~1 minute.
  token: string;
  expiresAt: number | null;
  model: string;
}

// Mint an ephemeral Realtime client secret pre-configured for transcription.
// The browser POSTs its SDP offer to /v1/realtime/calls using this token; the
// transcription model and session config are bound to the token server-side,
// so the browser never receives the real OpenAI API key.
export async function createRealtimeTranscriptionSecret(
  safetyIdentifier?: string,
): Promise<RealtimeTranscriptionSecret> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to kyron-scribe/.env to enable dictation.",
    );
  }

  const model = env.OPENAI_REALTIME_TRANSCRIBE_MODEL;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
  // Binds the safety identifier to the ephemeral token so the browser does not
  // have to send it on the later WebRTC connection.
  if (safetyIdentifier) headers["OpenAI-Safety-Identifier"] = safetyIdentifier;

  const response = await fetch(CLIENT_SECRETS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session: {
        type: "transcription",
        audio: {
          input: {
            transcription: { model, language: "en" },
            // Server-side VAD segments speech so transcript events fire. A short
            // silence window commits segments quickly, so text surfaces closer
            // to as-spoken instead of only after long pauses.
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 350,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to create realtime transcription session (${response.status}): ${detail}`,
    );
  }

  const data = (await response.json()) as {
    value?: string;
    expires_at?: number;
    client_secret?: { value?: string; expires_at?: number };
  };

  // The GA /client_secrets shape returns the token at the top level; older
  // shapes nested it under client_secret. Accept either defensively.
  const token = data.value ?? data.client_secret?.value;
  const expiresAt = data.expires_at ?? data.client_secret?.expires_at ?? null;

  if (!token) {
    throw new Error("Realtime session response did not include a client secret.");
  }

  return { token, expiresAt, model };
}

// Fallback path: transcribe a recorded audio file when live WebRTC is
// unavailable (browser, network, or permission issues).
export async function transcribeAudioFile(file: File): Promise<string> {
  const client = getOpenAIClient();
  const result = await client.audio.transcriptions.create({
    file,
    model: env.OPENAI_FILE_TRANSCRIBE_MODEL,
    language: "en",
  });

  return result.text.trim();
}
