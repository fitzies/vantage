import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

if (!env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not configured");
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tokenFromCallbackURL(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/\/invite\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function canSignUp(email: string, inviteToken: unknown) {
  const counts = await db.execute<{
    users: string | number;
    projects: string | number;
  }>(sql`
    select
      (select count(*) from "user")::bigint as users,
      (select count(*) from projects)::bigint as projects
  `);
  const users = Number(counts.rows[0]?.users ?? 0);
  const projects = Number(counts.rows[0]?.projects ?? 0);

  if (users === 0) {
    if (projects === 0) return true;
    return Boolean(
      env.BOOTSTRAP_OWNER_EMAIL &&
        email === env.BOOTSTRAP_OWNER_EMAIL.toLowerCase(),
    );
  }

  if (typeof inviteToken !== "string" || inviteToken.length < 24) return false;

  const invite = await db.execute<{ id: string }>(sql`
    select id::text as id
    from project_invitations
    where token = ${inviteToken}
      and lower(email) = ${email}
      and accepted_at is null
      and expires_at > now()
    limit 1
  `);

  return Boolean(invite.rows[0]);
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const email = normalizeEmail(ctx.body.email);
      const inviteToken = tokenFromCallbackURL(ctx.body.callbackURL);
      if (!email || !(await canSignUp(email, inviteToken))) {
        throw APIError.from("FORBIDDEN", {
          code: "SIGN_UP_NOT_ALLOWED",
          message: "Sign-up is limited to the bootstrap owner or invited users.",
        });
      }
      ctx.body.email = email;
    }),
  },
  plugins: [nextCookies()],
});
