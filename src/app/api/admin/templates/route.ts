import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { createTemplate, listAllTemplates } from "@/lib/templates/templateAdmin";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { toErrorResponse, validationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateTemplateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  promptText: z.string().trim().min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const templates = await listAllTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await req.json().catch(() => null);
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Template name and prompt text are required.");
    }

    const template = await createTemplate({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      promptText: parsed.data.promptText,
      adminId: admin.id,
    });

    await writeAuditLog({
      userId: admin.id,
      action: "TEMPLATE_CREATED",
      entityType: "Template",
      entityId: template.id,
      metadata: { name: template.name },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
