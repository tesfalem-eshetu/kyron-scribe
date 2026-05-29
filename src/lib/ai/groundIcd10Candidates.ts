import { searchIcd10Codes } from "@/lib/icd/searchIcd10Codes";
import type { ExtractedClinicalProblem, Icd10Candidate } from "./types";

const RESULTS_PER_PROBLEM = 5;
const MAX_CANDIDATES = 12;

export async function getGroundedIcd10Candidates(
  problems: ExtractedClinicalProblem[],
): Promise<Icd10Candidate[]> {
  const byCode = new Map<string, Icd10Candidate>();

  for (const problem of problems) {
    const results = await searchIcd10Codes(problem.phrase, RESULTS_PER_PROBLEM);
    for (const result of results) {
      const candidate: Icd10Candidate = {
        code: result.code,
        description: result.description,
        category: result.category,
        score: result.score,
        sourceProblem: problem.phrase,
      };
      const existing = byCode.get(candidate.code);
      if (!existing || candidate.score > existing.score) {
        byCode.set(candidate.code, candidate);
      }
    }
  }

  return Array.from(byCode.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}
