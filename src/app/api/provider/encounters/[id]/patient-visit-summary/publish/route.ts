import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse } from "@/lib/errors";
import { publishVisitSummary } from "@/lib/visitSummary/visitSummary";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Publish the patient visit summary to the encounter's patient visit record.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const result = await publishVisitSummary(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
