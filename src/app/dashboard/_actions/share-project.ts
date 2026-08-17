"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { requireCurrentUser } from "@/lib/user-auth/session";
import {
  assertProjectAccess,
  hasAnotherOwner,
  normalizeEmail,
} from "@/lib/user-auth/permissions";

type ShareResult =
  | { ok: true; message: string; inviteUrl?: string }
  | { ok: false; message: string };

async function inviteUrl(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const base = h.get("origin") ?? (host ? `${protocol}://${host}` : process.env.BETTER_AUTH_URL ?? "");

  return `${base}/invite/${encodeURIComponent(token)}`;
}

export async function shareProjectAction(input: {
  projectId: string;
  email: string;
}): Promise<ShareResult> {
  const currentUser = await requireCurrentUser();
  await assertProjectAccess(currentUser.id, input.projectId, "owner");

  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, message: "Enter an email address." };

  const token = randomBytes(24).toString("base64url");
  await db.execute(sql`
    insert into project_invitations (
      project_id,
      email,
      role,
      token,
      invited_by,
      expires_at
    ) values (
      ${input.projectId}::uuid,
      ${email},
      'viewer',
      ${token},
      ${currentUser.id},
      now() + interval '14 days'
    )
  `);

  return {
    ok: true,
    message: "Invite created. Send this link to the client.",
    inviteUrl: await inviteUrl(token),
  };
}

export async function removeProjectMemberAction(input: {
  projectId: string;
  userId: string;
}): Promise<ShareResult> {
  const currentUser = await requireCurrentUser();
  await assertProjectAccess(currentUser.id, input.projectId, "owner");

  if (input.userId === currentUser.id) {
    const safe = await hasAnotherOwner(input.projectId, currentUser.id);
    if (!safe) {
      return { ok: false, message: "A project needs at least one owner." };
    }
  }

  const removed = await db.execute<{ user_id: string }>(sql`
    delete from project_members
    where project_id = ${input.projectId}::uuid
      and user_id = ${input.userId}
      and role <> 'owner'
    returning user_id
  `);

  if (removed.rows.length === 0) {
    return { ok: false, message: "Owners cannot be removed here." };
  }

  return { ok: true, message: "Member removed." };
}
