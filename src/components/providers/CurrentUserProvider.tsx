"use client";

import { createContext, useContext } from "react";
import type { SafeUser } from "@/lib/client/types";

const CurrentUserContext = createContext<SafeUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: SafeUser;
  children: React.ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): SafeUser {
  const ctx = useContext(CurrentUserContext);
  if (!ctx)
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
