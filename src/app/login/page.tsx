import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { GraduationCapIcon } from "lucide-react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/authz";
import { signInAsDevUser } from "@/lib/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!features.database) return <SetupRequired />;

  const user = await getCurrentUser();
  if (user) redirect("/");

  const devUsers = features.devLogin
    ? await db.query.users
        .findMany({
          orderBy: [asc(users.role), asc(users.email)],
          columns: { id: true, name: true, email: true, role: true },
        })
        .catch(() => [])
    : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <GraduationCapIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Intern Portal</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to view assignments, submit work, and see feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your email and password to continue.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <LoginForm />

          {features.devLogin && (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs uppercase">or</span>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Dev login</p>
                  <Badge variant="secondary" className="text-xs">
                    development only
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  Skip the password — sign in as any seeded user. Disabled in production.
                </p>

                {devUsers.length > 0 ? (
                  <div className="grid gap-2">
                    {devUsers.map((u) => (
                      <form key={u.id} action={signInAsDevUser.bind(null, u.email)}>
                        <Button
                          type="submit"
                          variant="secondary"
                          className="h-auto w-full justify-between py-2"
                        >
                          <span className="flex flex-col items-start">
                            <span className="font-medium">{u.name ?? u.email}</span>
                            <span className="text-muted-foreground text-xs font-normal">
                              {u.email}
                            </span>
                          </span>
                          <Badge variant={u.role === "admin" ? "default" : "outline"}>
                            {u.role}
                          </Badge>
                        </Button>
                      </form>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                    No users yet. Run{" "}
                    <code className="text-foreground">npm run db:seed</code> to create a
                    demo admin and interns.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="text-muted-foreground text-xs">
          Accounts are created by your program admin. Trouble signing in? Use “Forgot
          password?” to set a new one.
        </CardFooter>
      </Card>
    </main>
  );
}
