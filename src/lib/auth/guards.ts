import { getSessionTokenFromCookie } from "@/lib/auth/cookies";
import { getSessionUser } from "@/lib/auth/session";
import { accountInactive, forbidden, unauthorized } from "@/lib/errors";
import type { User } from "@/generated/prisma/client";

export async function requireUser(): Promise<User> {
  const token = await getSessionTokenFromCookie();
  const user = await getSessionUser(token);

  if (!user) throw unauthorized();
  if (user.status === "INACTIVE") throw accountInactive();

  return user;
}

export async function requireProvider(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "PROVIDER") throw forbidden();
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}
