import { getOpenAIClient } from "./openaiClient";
import { env } from "../env";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { buildClinicalProblemExtractionInput, buildSoapGenerationInput } from "./prompts";
import type { ExtractedClinicalProblem, GenerateSoapNoteInput } from "./types";

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

const ClinicalProblemExtractionSchema = z.object({
  problems: z.array(
    z.object({
      phrase: z.string().min(1),
      evidence: z.string().min(1),
    }),
  ),
});

export async function extractClinicalProblems(
  transcript: string,
): Promise<ExtractedClinicalProblem[]> {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: env.OPENAI_PROBLEM_EXTRACT_MODEL,
    input: buildClinicalProblemExtractionInput(transcript),
    text: {
      format: zodTextFormat(
        ClinicalProblemExtractionSchema,
        "clinical_problem_extraction",
      ),
    },
  });

  return response.output_parsed?.problems ?? [];
}

export async function* generateSoapNoteStream(
  input: GenerateSoapNoteInput,
): AsyncGenerator<string> {
  const client = getOpenAIClient();
  const stream = await client.responses.create({
    model: env.OPENAI_SOAP_GENERATION_MODEL,
    input: buildSoapGenerationInput(input),
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}
