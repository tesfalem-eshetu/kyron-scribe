import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { createProvider, listProviders } from "@/lib/admin/providers";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateProviderSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1),
  password: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const providers = await listProviders();
    return NextResponse.json({ providers });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await req.json().catch(() => null);
    const parsed = CreateProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("A valid email and full name are required.");
    }

    const result = await createProvider(parsed.data);

    await writeAuditLog({
      userId: admin.id,
      action: "PROVIDER_CREATED",
      entityType: "User",
      entityId: result.user.id,
      metadata: { email: result.user.email },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
