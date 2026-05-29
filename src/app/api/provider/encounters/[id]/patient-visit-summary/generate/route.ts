import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse } from "@/lib/errors";
import { generateVisitSummary } from "@/lib/visitSummary/visitSummary";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Generate (or regenerate) a draft patient visit summary from the encounter's
// latest finalized note version.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const result = await generateVisitSummary(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
