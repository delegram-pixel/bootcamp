import { requireAdmin } from "@/lib/authz";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every /admin/* route is gated here: non-admins are redirected to /dashboard.
  await requireAdmin();
  return <>{children}</>;
}
