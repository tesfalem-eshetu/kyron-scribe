import { prisma } from "@/lib/prisma";
import type { EncounterStatus, Prisma } from "@/generated/prisma/client";

export interface AdminEncounterFilters {
  providerId?: string;
  status?: EncounterStatus;
  startDate?: Date;
  endDate?: Date;
}

// All providers' encounters with optional filters (master plan 9.6). Admin-only;
// the route enforces requireAdmin().
export async function listAdminEncounters(filters: AdminEncounterFilters) {
  const where: Prisma.EncounterWhereInput = {};

  if (filters.providerId) where.providerId = filters.providerId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  return prisma.encounter.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      patient: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
      },
      provider: { select: { id: true, fullName: true, email: true } },
      template: { select: { id: true, name: true } },
      draft: { select: { status: true } },
      note: { select: { id: true, currentVersionId: true } },
    },
  });
}
