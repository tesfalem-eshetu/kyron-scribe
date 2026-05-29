import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { getLatestNote } from "@/lib/notes/readNotes";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const note = await getLatestNote(id, user.id);
    return NextResponse.json({ note });
  } catch (error) {
    return toErrorResponse(error);
  }
}
