import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";

import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/authz";
import { getGroupByJoinCode } from "@/db/queries/groups";
import { JoinForm } from "@/components/auth/join-form";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Join your cohort" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (!features.database) return <SetupRequired />;

  // Already signed in? Nothing to register — send them into the portal.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { code } = await searchParams;
  const group = code ? await getGroupByJoinCode(code) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <GraduationCapIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {group ? `Join ${group.name}` : "Intern Portal"}
        </h1>
      </div>

      <Card>
        {group ? (
          <>
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                You’re joining <span className="text-foreground font-medium">{group.name}</span>{" "}
                as an intern. Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Sign in
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinForm code={code as string} groupName={group.name} />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Invite link invalid</CardTitle>
              <CardDescription>
                This invite link is invalid or has been turned off. Ask your program admin
                for a fresh link to join your cohort.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
