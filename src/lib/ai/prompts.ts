import type {
  GenerateSoapNoteInput,
  PatientContextSummaryInput,
} from "./types";
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

// Cheap classifier: decide whether the change between two finalized note
// versions is clinically meaningful enough to refresh the returning-patient
// context summary (master plan Section 9.5).
export function buildClinicalChangeClassificationInput(
  previousNote: string,
  currentNote: string,
): string {
  return [
    "You compare two versions of a clinical note for the same encounter.",
    "Decide whether the difference is clinically meaningful enough to update the",
    "patient's longitudinal context summary (e.g. new diagnosis, medication change,",
    "resolved problem, significant finding). Formatting, spelling, or wording-only",
    "edits are NOT meaningful.",
    "",
    "Return shouldUpdateSummary=true only for clinically meaningful changes, with a",
    "short reason. Otherwise return false with a short reason.",
    "",
    "PREVIOUS VERSION:",
    previousNote,
    "",
    "CURRENT VERSION:",
    currentNote,
  ].join("\n");
}

// Generate a concise, provider-scoped longitudinal context summary derived from
// the latest finalized note (master plan Section 8.3). This is derived AI
// context, not the legal record.
export function buildPatientContextSummaryInput(
  input: PatientContextSummaryInput,
): string {
  const priorSummaryBlock = input.priorSummary
    ? input.priorSummary
    : "None on file.";

  return [
    "You maintain a concise longitudinal clinical context summary for a single",
    "patient under one provider. Update the summary using the latest finalized",
    "note, carrying forward still-relevant prior context.",
    "",
    "Rules:",
    "- 2-5 sentences, plain clinical prose, no headings or bullet lists.",
    "- Capture durable, clinically relevant facts: chronic conditions, active",
    "  medications, allergies, ongoing problems, and notable history.",
    "- Do not invent anything not supported by the note or prior summary.",
    "- This is background context for future visits, not a full note.",
    "",
    `PRIOR SUMMARY:\n${priorSummaryBlock}`,
    "",
    `PRIOR FINALIZED ENCOUNTERS (including this one): ${input.priorEncounterCount}`,
    "",
    `PATIENT:\n${input.patientName}`,
    "",
    "LATEST FINALIZED NOTE:",
    `Subjective:\n${input.currentNote.subjective}`,
    `Objective:\n${input.currentNote.objective}`,
    `Assessment:\n${input.currentNote.assessment}`,
    `Plan:\n${input.currentNote.plan}`,
  ].join("\n");
}
