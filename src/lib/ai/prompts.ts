import type { GenerateSoapNoteInput } from "./types";
import { INSUFFICIENT_CLINICAL_CONTENT_MESSAGE } from "./types";

export function buildClinicalProblemExtractionInput(transcript: string): string {
  return [
    "Extract clinically meaningful diagnosis/problem phrases from the encounter transcript.",
    "Return only problems supported by the transcript.",
    "Use short phrases suitable for semantic ICD-10 retrieval, such as 'knee pain after running' or 'type 2 diabetes with high blood sugar'.",
    "If the input is not clinically meaningful, return an empty problems array.",
    "",
    "Transcript:",
    transcript,
  ].join("\n");
}

export function buildSoapGenerationInput(input: GenerateSoapNoteInput): string {
  const patientDob = input.patient.dateOfBirth.toISOString().slice(0, 10);
  const candidates =
    input.icd10Candidates.length > 0
      ? input.icd10Candidates
          .map(
            (candidate) =>
              `- ${candidate.code} - ${candidate.description} (${candidate.category ?? "Uncategorized"})`,
          )
          .join("\n")
      : "- No supported ICD-10 candidates found in the local catalog.";

  return [
    "You are an AI clinical documentation assistant for a provider-facing tool.",
    "Convert the transcript/observations into a professional SOAP note.",
    "",
    "Rules:",
    "- Do not invent facts not supported by the transcript or patient history.",
    '- If information is missing, omit it or state "Not documented."',
    "- Use the selected template to shape style and emphasis.",
    "- The provider will review and edit before saving.",
    "",
    "Clinical-content gate:",
    "- If the input lacks clinically meaningful content, return ONLY this exact text:",
    INSUFFICIENT_CLINICAL_CONTENT_MESSAGE,
    "",
    "ICD-10 rules:",
    "- Use ONLY codes from SUPPORTED ICD-10 CANDIDATES.",
    "- Copy code and description exactly. Do not invent or use codes from memory.",
    '- If none fit, write: "No supported ICD-10 code available from local catalog."',
    "",
    `PATIENT HISTORY CONTEXT:\n${input.patientHistoryContext}`,
    "",
    `SUPPORTED ICD-10 CANDIDATES:\n${candidates}`,
    "",
    `TEMPLATE:\nName: ${input.templateName}\nPrompt: ${input.templatePrompt}`,
    "",
    `PATIENT:\n${input.patient.firstName} ${input.patient.lastName}, DOB ${patientDob}`,
    "",
    `CURRENT TRANSCRIPT:\n${input.transcript}`,
    "",
    "Output format:",
    "Subjective:",
    "Objective:",
    "Assessment:",
    "Plan:",
  ].join("\n");
}
