import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/encounters");

  return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
}
