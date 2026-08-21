import Link from "next/link";
import { DatabaseIcon, TerminalIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown before DATABASE_URL is configured, so the very first run explains
 * itself instead of throwing a connection error.
 */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
          <DatabaseIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Intern Portal</h1>
          <p className="text-muted-foreground text-sm">Almost there — finish the setup.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connect a database</CardTitle>
          <CardDescription>
            Set <code className="text-foreground">DATABASE_URL</code> in{" "}
            <code className="text-foreground">.env.local</code>, then create the schema and
            seed demo data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="text-muted-foreground list-decimal space-y-3 pl-5">
            <li>
              Create a free Postgres database at{" "}
              <Link
                href="https://neon.tech"
                className="text-foreground underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                neon.tech
              </Link>{" "}
              and copy the pooled connection string.
            </li>
            <li>
              Paste it into <code className="text-foreground">.env.local</code> as{" "}
              <code className="text-foreground">DATABASE_URL</code>.
            </li>
            <li>Run the commands below.</li>
          </ol>

          <div className="bg-muted text-foreground flex items-start gap-3 rounded-lg p-4 font-mono text-xs">
            <TerminalIcon className="mt-0.5 size-4 shrink-0" />
            <pre className="overflow-x-auto">
              <code>{`npm run db:push    # create tables
npm run db:seed    # 1 admin, 4 interns, 2 groups, sample data
npm run dev        # restart`}</code>
            </pre>
          </div>

          <p className="text-muted-foreground">
            Full guidance for every service lives in{" "}
            <code className="text-foreground">.env.example</code> and{" "}
            <code className="text-foreground">README.md</code>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
