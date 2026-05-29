import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { toSafeUser } from "@/lib/auth/safeUser";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  accountInactive,
  toErrorResponse,
  unauthorized,
  validationError,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Email and password are required.");
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Generic error on both missing user and bad password to avoid enumeration.
    if (!user) {
      await writeAuditLog({ action: "LOGIN_FAILED", metadata: { email } });
      throw unauthorized("Invalid email or password.");
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      await writeAuditLog({
        userId: user.id,
        action: "LOGIN_FAILED",
        metadata: { email },
      });
      throw unauthorized("Invalid email or password.");
    }

    if (user.status === "INACTIVE") {
      await writeAuditLog({
        userId: user.id,
        action: "LOGIN_FAILED",
        metadata: { email, reason: "INACTIVE" },
      });
      throw accountInactive("This account has been deactivated.");
    }

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    await writeAuditLog({ userId: user.id, action: "LOGIN_SUCCESS" });

    return NextResponse.json({ user: toSafeUser(user) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
