import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { getNoteVersions } from "@/lib/notes/readNotes";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id } = await context.params;
    const { noteId, versions } = await getNoteVersions(id, user.id);
    return NextResponse.json({ noteId, versions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
