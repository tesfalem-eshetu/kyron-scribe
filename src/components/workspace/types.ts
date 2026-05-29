import type { ExtractedProblem, Icd10Candidate } from "@/lib/client/types";

export interface Grounding {
  problems: ExtractedProblem[];
  candidates: Icd10Candidate[];
}

export type SaveState = "idle" | "saving" | "saved" | "error";
