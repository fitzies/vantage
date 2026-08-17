import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import type { ProjectRole } from "@/lib/db/schema";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function roleAllows(actual: ProjectRole, required: ProjectRole) {
  if (required === "viewer") return actual === "viewer" || actual === "owner";
  return actual === "owner";
}

export async function getProjectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const result = await db.execute<{ role: ProjectRole }>(sql`
    select role
    from project_members
    where user_id = ${userId}
      and project_id = ${projectId}::uuid
    limit 1
  `);

  return result.rows[0]?.role ?? null;
}

export async function assertProjectAccess(
  userId: string,
  projectId: string,
  requiredRole: ProjectRole = "viewer",
): Promise<ProjectRole> {
  const role = await getProjectRole(userId, projectId);
  if (!role || !roleAllows(role, requiredRole)) {
    throw new Error("forbidden");
  }
  return role;
}

export async function hasAnotherOwner(projectId: string, exceptUserId: string) {
  const result = await db.execute<{ count: string | number }>(sql`
    select count(*)::bigint as count
    from project_members
    where project_id = ${projectId}::uuid
      and user_id <> ${exceptUserId}
      and role = 'owner'
  `);

  return Number(result.rows[0]?.count ?? 0) > 0;
}
