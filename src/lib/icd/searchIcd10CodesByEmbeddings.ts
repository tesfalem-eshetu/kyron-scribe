import { prisma } from "@/lib/prisma";

export interface Icd10SearchResult {
  id: string;
  code: string;
  description: string;
  category: string | null;
  // Cosine similarity in [0, 1]; higher means a closer semantic match.
  score: number;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

// Ranks active codes by cosine distance to the query vector using pgvector's
// `<=>` operator (cosine distance, 0 = identical). Similarity = 1 - distance.
export async function searchIcd10CodesByEmbedding(
  queryVector: number[],
  limit = 8,
): Promise<Icd10SearchResult[]> {
  const literal = toVectorLiteral(queryVector);

  const rows = await prisma.$queryRaw<
    {
      id: string;
      code: string;
      description: string;
      category: string | null;
      score: number;
    }[]
  >`
    SELECT
      id,
      code,
      description,
      category,
      1 - (embedding <=> ${literal}::vector) AS score
    FROM "Icd10Code"
    WHERE "isActive" = true AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({ ...row, score: Number(row.score) }));
}
