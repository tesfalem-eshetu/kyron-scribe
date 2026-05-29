export interface SearchableIcd10Input {
  description: string;
  category?: string | null;
  synonyms: string[];
}

// The text that gets embedded for semantic search. We embed clinical meaning
// (description + category + lay synonyms), not the code itself, since the code
// string carries no semantic signal for plain-English queries.
export function buildSearchableText(entry: SearchableIcd10Input): string {
  return [entry.description, entry.category ?? "", ...entry.synonyms]
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
}
