import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SESSION_COOKIE_NAME: z.string().min(1).default("session_token"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  // Optional so the app still boots locally before a key is configured.
  // openaiClient throws a clear error if it is missing when actually used.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_SOAP_GENERATION_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_PROBLEM_EXTRACT_MODEL: z.string().min(1).default("gpt-4o-mini"),
  // Realtime WebRTC dictation (live) and recorded-audio fallback transcription.
  OPENAI_REALTIME_TRANSCRIBE_MODEL: z
    .string()
    .min(1)
    .default("gpt-4o-transcribe"),
  OPENAI_FILE_TRANSCRIBE_MODEL: z
    .string()
    .min(1)
    .default("gpt-4o-mini-transcribe"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:\n",
    JSON.stringify(parsed.error.issues, null, 2),
  );
  throw new Error(
    "Invalid environment variables. Check your .env file against .env.example.",
  );
}

export const env = parsed.data;
