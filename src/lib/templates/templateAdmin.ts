import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

const TEMPLATE_FIELDS = {
  id: true,
  name: true,
  description: true,
  promptText: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Admin sees all templates, including soft-deleted (inactive) ones.
export async function listAllTemplates() {
  return prisma.template.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: TEMPLATE_FIELDS,
  });
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  promptText: string;
  adminId: string;
}

export async function createTemplate(input: CreateTemplateInput) {
  return prisma.template.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      promptText: input.promptText,
      isActive: true,
      createdById: input.adminId,
      updatedById: input.adminId,
    },
    select: TEMPLATE_FIELDS,
  });
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  promptText?: string;
  isActive?: boolean;
}

export async function updateTemplate(
  templateId: string,
  input: UpdateTemplateInput,
  adminId: string,
) {
  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!existing) throw notFound("Template not found.");

  return prisma.template.update({
    where: { id: templateId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.promptText !== undefined ? { promptText: input.promptText } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedById: adminId,
    },
    select: TEMPLATE_FIELDS,
  });
}

// Soft delete: deactivate so historical encounters keep their template
// references (master plan 9.6).
export async function softDeleteTemplate(templateId: string, adminId: string) {
  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!existing) throw notFound("Template not found.");

  return prisma.template.update({
    where: { id: templateId },
    data: { isActive: false, updatedById: adminId },
    select: TEMPLATE_FIELDS,
  });
}
