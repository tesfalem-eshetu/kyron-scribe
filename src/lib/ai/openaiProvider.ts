import { getOpenAIClient } from "./openaiClient";
import { env } from "../env";

// vector(1536) in the schema is tied to text-embedding-3-small's native size.
export const EMBEDDING_DIMENSIONS = 1536;

// Embed a batch of texts in a single API call. Returns vectors in the same
// order as the input, regardless of the order the API returns them.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
  });

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding as number[]);
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
