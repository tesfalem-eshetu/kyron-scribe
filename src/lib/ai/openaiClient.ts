import OpenAI from "openai";
import { env } from "../env";

// Server-only by convention: this module reads OPENAI_API_KEY and must never be
// imported into a client component. Relative imports (not the "@/" alias) keep
// it usable from both Next route handlers and standalone tsx scripts.

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to kyron-scribe/.env to enable embeddings and AI generation.",
    );
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cachedClient;
}
