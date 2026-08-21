import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";

import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/authz";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { SetupRequired } from "@/components/setup-required";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  if (!features.database) return <SetupRequired />;

  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <GraduationCapIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we’ll send a link to set a new password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            We’ll email a reset link if the account exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter className="text-muted-foreground text-xs">
          Remembered it?
          <Link
            href="/login"
            className="text-foreground ml-1 underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
