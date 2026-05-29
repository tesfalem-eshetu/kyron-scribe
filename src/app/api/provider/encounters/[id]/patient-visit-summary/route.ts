import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse, validationError } from "@/lib/errors";
import {
  getVisitSummary,
  updateVisitSummary,
} from "@/lib/visitSummary/visitSummary";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Load the patient visit summary (or null) for an encounter the provider owns.
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const result = await getVisitSummary(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Save provider edits to the summary draft.
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;

    const body = (await req.json().catch(() => null)) as {
      summaryText?: unknown;
      followUpText?: unknown;
    } | null;
    if (!body || typeof body.summaryText !== "string") {
      throw validationError("summaryText is required.");
    }

    const result = await updateVisitSummary(id, user.id, {
      summaryText: body.summaryText,
      followUpText:
        typeof body.followUpText === "string" ? body.followUpText : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
