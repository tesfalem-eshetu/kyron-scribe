import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";

export const dynamic = "force-dynamic";

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "PROVIDER") redirect("/admin/encounters");

  return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
}
