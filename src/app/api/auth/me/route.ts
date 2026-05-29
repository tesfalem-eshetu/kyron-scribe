import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { toSafeUser } from "@/lib/auth/safeUser";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ user: toSafeUser(user) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
