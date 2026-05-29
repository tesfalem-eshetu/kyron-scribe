import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { toSafeUser, type SafeUser } from "@/lib/auth/safeUser";
import { deleteAllSessionsForUser } from "@/lib/auth/session";
import { conflict, notFound } from "@/lib/errors";

function generateTemporaryPassword(): string {
  // ~12 url-safe characters; the admin shares this with the provider once.
  return randomBytes(9).toString("base64url");
}

export async function listProviders() {
  return prisma.user.findMany({
    where: { role: "PROVIDER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      createdAt: true,
      _count: { select: { encounters: true } },
    },
  });
}

export interface CreateProviderInput {
  email: string;
  fullName: string;
  password?: string;
}

export interface CreateProviderResult {
  user: SafeUser;
  // Present only when the server generated the password (so the admin can share
  // it once). Never stored or returned again.
  temporaryPassword?: string;
}

export async function createProvider(
  input: CreateProviderInput,
): Promise<CreateProviderResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw conflict("A user with this email already exists.");

  const generated = input.password ? undefined : generateTemporaryPassword();
  const plainPassword = input.password ?? generated!;
  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      role: "PROVIDER",
      status: "ACTIVE",
      passwordHash,
    },
  });

  return { user: toSafeUser(user), temporaryPassword: generated };
}

// Activate or deactivate a provider. Deactivation also revokes all active
// sessions so the next request fails immediately (master plan 9.6, Scenario 2).
export async function setProviderStatus(
  providerId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SafeUser> {
  const target = await prisma.user.findFirst({
    where: { id: providerId, role: "PROVIDER" },
    select: { id: true },
  });
  if (!target) throw notFound("Provider not found.");

  const user = await prisma.user.update({
    where: { id: providerId },
    data: { status },
  });

  if (status === "INACTIVE") {
    await deleteAllSessionsForUser(providerId);
  }

  return toSafeUser(user);
}
