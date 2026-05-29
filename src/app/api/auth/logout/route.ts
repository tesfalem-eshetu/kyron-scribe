import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionTokenFromCookie,
} from "@/lib/auth/cookies";
import { deleteSession, getSessionUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await getSessionTokenFromCookie();
    const user = await getSessionUser(token);

    await deleteSession(token);
    await clearSessionCookie();

    if (user) {
      await writeAuditLog({ userId: user.id, action: "LOGOUT" });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
