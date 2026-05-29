import { embedText } from "@/lib/ai/openaiProvider";
import {
  searchIcd10CodesByEmbedding,
  type Icd10SearchResult,
} from "@/lib/icd/searchIcd10CodesByEmbeddings";

// End-to-end semantic search: embed the free-text query, then rank codes by
// cosine similarity. Returns [] for empty queries without calling the API.
export async function searchIcd10Codes(
  query: string,
  limit = 8,
): Promise<Icd10SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryVector = await embedText(trimmed);
  return searchIcd10CodesByEmbedding(queryVector, limit);
}
