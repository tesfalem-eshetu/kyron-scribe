import { getSessionTokenFromCookie } from "@/lib/auth/cookies";
import { getSessionUser } from "@/lib/auth/session";
import { toSafeUser, type SafeUser } from "@/lib/auth/safeUser";

// Non-throwing variant for server components/layouts. Returns the active,
// session-backed user or null. Inactive users are treated as logged out.
export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = await getSessionTokenFromCookie();
  const user = await getSessionUser(token);
  if (!user) return null;
  if (user.status === "INACTIVE") return null;
  return toSafeUser(user);
}
