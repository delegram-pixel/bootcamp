import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db, getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { env, features } from "@/lib/env";

const providers: Provider[] = [];

// Email + password — the real sign-in method for everyone. Available whenever a
// database is wired up, since that's where the password hashes live.
if (features.database) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        // No hash yet → the account hasn't set a password; they must go through
        // the set-password email link first.
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  );
}

if (features.devLogin) {
  // DEV ONLY. Sign in as any existing (seeded/invited) user by email, no password.
  // Guarded by env.features.devLogin, which is forced off in production.
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  );
}

export const authConfig = {
  // The Drizzle adapter sniffs the dialect off the db object, so it needs the
  // real instance (not the lazy Proxy) — and only when a DB is actually wired
  // up. Without one there's nothing to persist to, and `next build` / the setup
  // screen must not touch a connection.
  adapter: features.database
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  // Credentials provider requires JWT sessions; also avoids a DB hit per request.
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present at sign-in. Persist id + role onto the token so
      // subsequent requests need no DB round-trip.
      if (user) {
        token.id = user.id as string;
        // role is present from the adapter user / credentials authorize
        token.role = (user as { role?: "admin" | "intern" }).role ?? "intern";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = (token.role as "admin" | "intern") ?? "intern";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
