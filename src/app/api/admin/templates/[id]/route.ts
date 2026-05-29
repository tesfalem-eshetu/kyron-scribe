import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { softDeleteTemplate, updateTemplate } from "@/lib/templates/templateAdmin";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UpdateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    promptText: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("No valid template fields to update.");
    }

    const template = await updateTemplate(id, parsed.data, admin.id);

    await writeAuditLog({
      userId: admin.id,
      action: "TEMPLATE_UPDATED",
      entityType: "Template",
      entityId: template.id,
      metadata: { fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ template });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const template = await softDeleteTemplate(id, admin.id);

    await writeAuditLog({
      userId: admin.id,
      action: "TEMPLATE_ARCHIVED",
      entityType: "Template",
      entityId: template.id,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return toErrorResponse(error);
  }
}
