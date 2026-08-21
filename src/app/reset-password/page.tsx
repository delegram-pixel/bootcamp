import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";

import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/authz";
import { resetTokenStatus } from "@/lib/auth/reset";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!features.database) return <SetupRequired />;

  const user = await getCurrentUser();
  if (user) redirect("/");

  const { token } = await searchParams;
  const status = token ? await resetTokenStatus(token) : "invalid";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <GraduationCapIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      </div>

      <Card>
        {status === "valid" ? (
          <>
            <CardHeader>
              <CardTitle>Choose a password</CardTitle>
              <CardDescription>
                Pick something you’ll remember — at least 8 characters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm token={token as string} />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>
                {status === "used" ? "Link already used" : "Link invalid or expired"}
              </CardTitle>
              <CardDescription>
                {status === "used"
                  ? "This reset link has already been used to set a password."
                  : "This reset link is invalid or has expired."}{" "}
                Request a new one to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
