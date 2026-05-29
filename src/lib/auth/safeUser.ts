import type { User } from "@/generated/prisma/client";

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: User["role"];
  status: User["status"];
}

// Strips passwordHash and any other sensitive fields before returning a user.
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  };
}
