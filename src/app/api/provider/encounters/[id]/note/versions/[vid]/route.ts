import { NextRequest, NextResponse } from "next/server";
import { requireProvider } from "@/lib/auth/guards";
import { getNoteVersion } from "@/lib/notes/readNotes";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; vid: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireProvider();
    const { id, vid } = await context.params;
    const version = await getNoteVersion(id, user.id, vid);
    return NextResponse.json({ version });
  } catch (error) {
    return toErrorResponse(error);
  }
}
