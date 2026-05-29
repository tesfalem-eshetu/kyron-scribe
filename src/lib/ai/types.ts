export const INSUFFICIENT_CLINICAL_CONTENT_MESSAGE =
  "[INSUFFICIENT_CLINICAL_CONTENT]\nThe provided input does not contain enough clinically meaningful information to generate a SOAP note. Please add symptoms, relevant history, exam findings, diagnosis, or plan details.";

export interface ExtractedClinicalProblem {
  phrase: string;
  evidence: string;
}

export interface Icd10Candidate {
  code: string;
  description: string;
  category: string | null;
  score: number;
  sourceProblem: string;
}

export interface GenerateSoapNoteInput {
  transcript: string;
  templateName: string;
  templatePrompt: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
  };
  patientHistoryContext: string;
  icd10Candidates: Icd10Candidate[];
}
