import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/auth/guards";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Active templates for the provider's template dropdown.
export async function GET() {
  try {
    await requireProvider();

    const templates = await prisma.template.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return toErrorResponse(error);
  }
}
