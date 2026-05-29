"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, Table2, UserRoundCheck } from "lucide-react";
import {
  initialsOf,
  useCurrentUser,
} from "@/components/providers/CurrentUserProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiFetch } from "@/lib/client/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
}

const PROVIDER_NAV: NavItem[] = [
  { href: "/encounters", label: "Encounters", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/encounters", label: "Encounters", icon: Table2 },
  { href: "/admin/providers", label: "Providers", icon: UserRoundCheck },
  { href: "/admin/templates", label: "Templates", icon: FileText },
];

export function AppShell({
  variant,
  pageClassName = "page-narrow",
  children,
}: {
  variant: "provider" | "admin";
  pageClassName?: string;
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const nav = variant === "admin" ? ADMIN_NAV : PROVIDER_NAV;

  async function signOut() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — clear and redirect regardless */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link
          href={variant === "admin" ? "/admin/encounters" : "/encounters"}
          className="tb-brand"
        >
          <span className="tb-mark" aria-hidden="true">
            K
          </span>
          <span className="nm">Kyron Scribe</span>
        </Link>
        <nav className="rolenav" aria-label="Primary">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span className="label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="tb-right">
          <ThemeToggle />
          <div className="tb-sep" aria-hidden="true" />
          <div className="tb-user">
            <div className="tb-avatar" aria-hidden="true">
              {initialsOf(user.fullName)}
            </div>
            <div>
              <div className="uname">{user.fullName}</div>
              <span className={`urole ${variant === "admin" ? "admin" : ""}`}>
                {variant === "admin" ? "Admin" : "Provider"}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            <LogOut aria-hidden="true" />
            <span className="label">Sign out</span>
          </button>
        </div>
      </header>
      <main className={`page ${pageClassName}`}>{children}</main>
    </div>
  );
}
