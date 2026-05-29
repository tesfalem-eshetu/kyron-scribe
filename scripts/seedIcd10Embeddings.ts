import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { embedTexts, EMBEDDING_DIMENSIONS } from "../src/lib/ai/openaiProvider";

// One-time (idempotent) embedding generation. Only rows whose embedding is NULL
// are processed, so this is safe to re-run after adding new codes. Requires
// OPENAI_API_KEY in the environment.

const BATCH_SIZE = 96;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function main() {
  const rows = await prisma.$queryRaw<{ id: string; searchableText: string }[]>`
    SELECT id, "searchableText"
    FROM "Icd10Code"
    WHERE embedding IS NULL
    ORDER BY code
  `;

  if (rows.length === 0) {
    console.log("All ICD-10 codes already have embeddings. Nothing to do.");
    return;
  }

  console.log(`Generating embeddings for ${rows.length} ICD-10 codes...`);
  let done = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const vectors = await embedTexts(batch.map((row) => row.searchableText));

    for (let j = 0; j < batch.length; j++) {
      const vector = vectors[j];
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding size ${vector.length} (expected ${EMBEDDING_DIMENSIONS}) for code id ${batch[j].id}`,
        );
      }
      const literal = toVectorLiteral(vector);
      await prisma.$executeRaw`
        UPDATE "Icd10Code" SET embedding = ${literal}::vector WHERE id = ${batch[j].id}
      `;
    }

    done += batch.length;
    console.log(`Embedded ${done}/${rows.length}`);
  }

  console.log("Done generating ICD-10 embeddings.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
