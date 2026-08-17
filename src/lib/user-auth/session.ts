import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { auth } from "./server";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const normalizedEmail = user.email.toLowerCase();

  // Bootstrap safety: when upgrading an existing single-admin install, only
  // the configured owner email can claim existing projects.
  if (env.BOOTSTRAP_OWNER_EMAIL?.toLowerCase() === normalizedEmail) {
    await db.execute(sql`
      insert into project_members (project_id, user_id, role)
      select p.id, ${user.id}, 'owner'::project_role
      from projects p
      where not exists (
        select 1
        from project_members pm
        where pm.project_id = p.id
          and pm.role = 'owner'
      )
      on conflict do nothing
    `);
  }

  return user;
}
