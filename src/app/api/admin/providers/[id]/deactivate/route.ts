import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { setProviderStatus } from "@/lib/admin/providers";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const provider = await setProviderStatus(id, "INACTIVE");

    await writeAuditLog({
      userId: admin.id,
      action: "PROVIDER_DEACTIVATED",
      entityType: "User",
      entityId: provider.id,
    });

    return NextResponse.json({ provider });
  } catch (error) {
    return toErrorResponse(error);
  }
}
