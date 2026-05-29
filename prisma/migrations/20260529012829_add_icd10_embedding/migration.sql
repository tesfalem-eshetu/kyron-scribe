-- Enable pgvector and add the embedding column to the ICD-10 catalog.
-- Prisma cannot model the vector type natively, so this is hand-written SQL.
-- vector(1536) matches OpenAI text-embedding-3-small output dimensions.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Icd10Code"
ADD COLUMN "embedding" vector(1536);

-- Optional ANN index (enable only if the catalog grows well beyond ~300 rows):
-- CREATE INDEX "icd10_embedding_hnsw_idx"
-- ON "Icd10Code" USING hnsw ("embedding" vector_cosine_ops);
