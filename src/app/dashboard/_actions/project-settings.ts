"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { assertProjectAccess } from "@/lib/user-auth/permissions";
import { requireCurrentUser } from "@/lib/user-auth/session";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "slug is required")
  .max(64, "slug must be ≤ 64 chars")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "slug must be lowercase letters, digits, and dashes",
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, "name is required")
  .max(256, "name must be ≤ 256 chars");

const projectIdSchema = z.string().uuid("invalid project id");

type ProjectMutationResult =
  | { ok: true; project: { id: string; slug: string; name: string } }
  | { ok: false; message: string };

type DeleteProjectResult = { ok: true } | { ok: false; message: string };

export async function updateProjectAction(input: {
  projectId: string;
  slug: string;
  name: string;
}): Promise<ProjectMutationResult> {
  const user = await requireCurrentUser();
  const projectId = projectIdSchema.safeParse(input.projectId);
  if (!projectId.success) return { ok: false, message: "Invalid project." };

  const slug = slugSchema.safeParse(input.slug);
  if (!slug.success) {
    return { ok: false, message: slug.error.issues[0]?.message ?? "Invalid slug." };
  }

  const name = nameSchema.safeParse(input.name);
  if (!name.success) {
    return { ok: false, message: name.error.issues[0]?.message ?? "Invalid name." };
  }

  await assertProjectAccess(user.id, projectId.data, "owner");

  try {
    const result = await db.execute<{ id: string; slug: string; name: string }>(sql`
      update projects
      set slug = ${slug.data}, name = ${name.data}
      where id = ${projectId.data}::uuid
      returning id::text as id, slug, name
    `);

    const project = result.rows[0];
    if (!project) return { ok: false, message: "Project not found." };

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${project.slug}`);
    return { ok: true, project };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message = String((err as Error).message ?? "");
    if (code === "23505" || /unique constraint/i.test(message)) {
      return { ok: false, message: `A project with slug "${slug.data}" already exists.` };
    }

    console.error("[vantage] updateProjectAction failed", err);
    return { ok: false, message: "Could not update project. Try again." };
  }
}

export async function deleteProjectAction(input: {
  projectId: string;
  confirmSlug: string;
}): Promise<DeleteProjectResult> {
  const user = await requireCurrentUser();
  const projectId = projectIdSchema.safeParse(input.projectId);
  if (!projectId.success) return { ok: false, message: "Invalid project." };

  await assertProjectAccess(user.id, projectId.data, "owner");

  const current = await db.execute<{ slug: string }>(sql`
    select slug
    from projects
    where id = ${projectId.data}::uuid
    limit 1
  `);

  const slug = current.rows[0]?.slug;
  if (!slug) return { ok: false, message: "Project not found." };
  if (input.confirmSlug.trim() !== slug) {
    return { ok: false, message: `Type "${slug}" to delete this project.` };
  }

  await db.execute(sql`
    delete from projects
    where id = ${projectId.data}::uuid
  `);

  revalidatePath("/dashboard");
  return { ok: true };
}
