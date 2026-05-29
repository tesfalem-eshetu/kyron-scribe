import { getOpenAIClient } from "./openaiClient";
import { env } from "../env";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  buildClinicalProblemExtractionInput,
  buildClinicalChangeClassificationInput,
  buildPatientContextSummaryInput,
  buildSoapGenerationInput,
} from "./prompts";
import type {
  ClinicalChangeClassification,
  ExtractedClinicalProblem,
  GenerateSoapNoteInput,
  PatientContextSummaryInput,
} from "./types";

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

const ClinicalChangeClassificationSchema = z.object({
  shouldUpdateSummary: z.boolean(),
  reason: z.string(),
});

// Cheap model: classify whether the diff between two finalized note versions is
// clinically meaningful (master plan Section 9.5). Defaults to updating if the
// model returns nothing, so meaningful changes are never silently dropped.
export async function classifyClinicalChangeSignificance(
  previousNote: string,
  currentNote: string,
): Promise<ClinicalChangeClassification> {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: env.OPENAI_PROBLEM_EXTRACT_MODEL,
    input: buildClinicalChangeClassificationInput(previousNote, currentNote),
    text: {
      format: zodTextFormat(
        ClinicalChangeClassificationSchema,
        "clinical_change_classification",
      ),
    },
  });

  return (
    response.output_parsed ?? {
      shouldUpdateSummary: true,
      reason: "Classifier returned no result; defaulting to update.",
    }
  );
}

// Cheap model: produce the provider-scoped longitudinal context summary text
// from the latest finalized note plus any prior summary (master plan 8.3).
export async function generatePatientContextSummary(
  input: PatientContextSummaryInput,
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: env.OPENAI_PROBLEM_EXTRACT_MODEL,
    input: buildPatientContextSummaryInput(input),
  });

  return response.output_text.trim();
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
