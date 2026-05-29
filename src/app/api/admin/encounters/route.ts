import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { listAdminEncounters } from "@/lib/admin/listAdminEncounters";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const StatusSchema = z.enum([
  "DRAFT",
  "GENERATING",
  "GENERATED",
  "FINALIZED",
  "ERROR",
]);

function parseDateParam(value: string | null, label: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`Invalid ${label} date.`);
  }
  return date;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const params = req.nextUrl.searchParams;

    let status;
    const statusParam = params.get("status");
    if (statusParam) {
      const parsed = StatusSchema.safeParse(statusParam);
      if (!parsed.success) throw validationError("Invalid status filter.");
      status = parsed.data;
    }

    const encounters = await listAdminEncounters({
      providerId: params.get("providerId") ?? undefined,
      status,
      startDate: parseDateParam(params.get("startDate"), "start"),
      endDate: parseDateParam(params.get("endDate"), "end"),
    });

    return NextResponse.json({ encounters });
  } catch (error) {
    return toErrorResponse(error);
  }
}
