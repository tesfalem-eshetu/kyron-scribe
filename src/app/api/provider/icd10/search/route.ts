import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse, validationError } from "@/lib/errors";
import { searchIcd10Codes } from "@/lib/icd/searchIcd10Codes";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 8;

// Semantic ICD-10 search for providers: GET /api/provider/icd10/search?q=...
export async function GET(req: NextRequest) {
  try {
    await requireProvider();

    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (query.length < MIN_QUERY_LENGTH) {
      throw validationError(
        `Query must be at least ${MIN_QUERY_LENGTH} characters.`,
      );
    }

    const results = await searchIcd10Codes(query, RESULT_LIMIT);
    return NextResponse.json({ query, results });
  } catch (error) {
    return toErrorResponse(error);
  }
}
