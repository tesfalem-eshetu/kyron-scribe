import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin/encounters" : "/encounters");
}
