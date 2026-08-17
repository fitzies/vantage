import "server-only";

import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";

/**
 * Project creation — used by both the seed script and the dashboard's
 * "+ New project" UI.
 *
 * Slugs are the tenant boundary. Once a project has events written under
 * a slug, renaming it breaks every historical query, so we lock the
 * format down here: lowercase ASCII, digits, and dashes only. Length cap
 * matches text columns on the projects table.
 */

const slugSchema = z
  .string()
  .min(1, "slug is required")
  .max(64, "slug must be ≤ 64 chars")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "slug must be lowercase letters, digits, and dashes (no leading/trailing dash)",
  );

const nameSchema = z
  .string()
  .trim()
  .max(256, "name must be ≤ 256 chars")
  .optional();

const inputSchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  ownerUserId: z.string().min(1, "owner user id is required"),
});

export type CreateProjectInput = z.infer<typeof inputSchema>;

export interface CreatedProject {
  id: string;
  slug: string;
  name: string;
  writeKey: string;
}

export class ProjectCreateError extends Error {
  readonly code:
    | "invalid_input"
    | "slug_taken"
    | "db_error";
  constructor(
    code: "invalid_input" | "slug_taken" | "db_error",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "ProjectCreateError";
  }
}

/**
 * Public write key. The `pk` is a tell to anyone reading the DB that
 * this isn't a secret — it identifies a project, no auth weight.
 */
export function generateWriteKey(): string {
  return `vntg_pk_${randomBytes(16).toString("hex")}`;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<CreatedProject> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ProjectCreateError(
      "invalid_input",
      first?.message ?? "invalid input",
    );
  }

  const slug = parsed.data.slug.toLowerCase();
  const name = parsed.data.name && parsed.data.name.length > 0
    ? parsed.data.name
    : slug;
  const writeKey = generateWriteKey();

  let row: { id: string; slug: string; name: string; writeKey: string } | undefined;
  try {
    const inserted = await db.execute<{
      id: string;
      slug: string;
      name: string;
      writeKey: string;
    }>(sql`
      with inserted as (
        insert into projects (slug, name, write_key)
        values (${slug}, ${name}, ${writeKey})
        returning id, slug, name, write_key
      ), member as (
        insert into project_members (project_id, user_id, role)
        select id, ${parsed.data.ownerUserId}, 'owner'::project_role
        from inserted
      )
      select
        id::text as id,
        slug,
        name,
        write_key as "writeKey"
      from inserted
    `);
    row = inserted.rows[0];
  } catch (err) {
    // Postgres unique-violation surfaces as code 23505. Drizzle's
    // neon-http driver re-throws the underlying error verbatim.
    const code = (err as { code?: string }).code;
    const message = String((err as Error).message ?? "");
    if (code === "23505" || /unique constraint/i.test(message)) {
      throw new ProjectCreateError(
        "slug_taken",
        `a project with slug "${slug}" already exists`,
      );
    }
    throw new ProjectCreateError("db_error", message || "insert failed");
  }

  if (!row) {
    throw new ProjectCreateError("db_error", "insert returned no row");
  }
  return row;
}
