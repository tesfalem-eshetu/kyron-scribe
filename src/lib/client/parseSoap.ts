import type { NoteSections } from "@/lib/client/types";

const EMPTY: NoteSections = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

// The model streams a single blob with "Subjective:/Objective:/Assessment:/Plan:"
// headers (see src/lib/ai/prompts.ts). Split it into editable sections. Tolerant
// of markdown emphasis and partial headers while streaming.
export function parseSoapSections(text: string): NoteSections {
  if (!text || text.trim().startsWith("[INSUFFICIENT_CLINICAL_CONTENT]")) {
    return { ...EMPTY };
  }

  const headers: { key: keyof NoteSections; re: RegExp }[] = [
    { key: "subjective", re: /^\s*\**\s*subjective\s*\**\s*:?/i },
    { key: "objective", re: /^\s*\**\s*objective\s*\**\s*:?/i },
    { key: "assessment", re: /^\s*\**\s*assessment\s*\**\s*:?/i },
    { key: "plan", re: /^\s*\**\s*plan\s*\**\s*:?/i },
  ];

  // The model is instructed to keep ICD-10 codes inside Assessment, but it
  // sometimes emits a trailing "ICD-10:" block after Plan. Fold any such block
  // back into Assessment rather than letting it leak into the Plan section.
  const icd10HeaderRe = /^\s*\**\s*icd[-\s]?10(\s*codes)?\s*\**\s*:?/i;

  const result: NoteSections = { ...EMPTY };
  let current: keyof NoteSections | null = null;

  for (const rawLine of text.split("\n")) {
    if (icd10HeaderRe.test(rawLine)) {
      current = "assessment";
      const rest = rawLine.replace(icd10HeaderRe, "").trim();
      if (rest) result.assessment += (result.assessment ? "\n" : "") + rest;
      continue;
    }
    const matched = headers.find((h) => h.re.test(rawLine));
    if (matched) {
      current = matched.key;
      const rest = rawLine.replace(matched.re, "").trim();
      result[current] = rest ? rest + "\n" : "";
      continue;
    }
    if (current) {
      result[current] += rawLine + "\n";
    }
  }

  (Object.keys(result) as (keyof NoteSections)[]).forEach((k) => {
    result[k] = result[k].replace(/\s+$/, "");
  });

  return result;
}

export function isSectionsEmpty(s: NoteSections): boolean {
  return !s.subjective && !s.objective && !s.assessment && !s.plan;
}
