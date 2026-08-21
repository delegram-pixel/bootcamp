import { redirect } from "next/navigation";

import { SetupRequired } from "@/components/setup-required";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/authz";

export default async function Home() {
  if (!features.database) return <SetupRequired />;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
