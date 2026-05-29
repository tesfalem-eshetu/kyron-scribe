import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SESSION_COOKIE_NAME: z.string().min(1).default("session_token"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
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
