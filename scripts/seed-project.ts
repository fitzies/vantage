/**
 * Create a new project + write key for an existing Vantage user.
 *
 * Usage:
 *   pnpm tsx scripts/seed-project.ts <owner-email> <slug> [name]
 */
import { randomBytes } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

function generateWriteKey(): string {
  return `vntg_pk_${randomBytes(16).toString("hex")}`;
}

function validSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length <= 64;
}

async function main() {
  const [, , ownerEmailRaw, rawSlug, ...nameParts] = process.argv;
  if (!ownerEmailRaw || !rawSlug) {
    console.error("usage: pnpm tsx scripts/seed-project.ts <owner-email> <slug> [name]");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL or POSTGRES_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const ownerEmail = ownerEmailRaw.trim().toLowerCase();
  const owner = (await sql`
    select id from "user" where lower(email) = ${ownerEmail} limit 1
  `) as { id: string }[];

  const ownerId = owner[0]?.id;
  if (!ownerId) {
    console.error(`owner user not found: ${ownerEmail}`);
    process.exit(1);
  }

  const slug = rawSlug.trim().toLowerCase();
  if (!validSlug(slug)) {
    console.error("slug must be lowercase letters, digits, and dashes");
    process.exit(1);
  }

  const name = nameParts.join(" ").trim() || slug;
  const writeKey = generateWriteKey();

  try {
    const rows = (await sql`
      with inserted as (
        insert into projects (slug, name, write_key)
        values (${slug}, ${name}, ${writeKey})
        returning id, slug, name, write_key
      ), member as (
        insert into project_members (project_id, user_id, role)
        select id, ${ownerId}, 'owner'::project_role
        from inserted
      )
      select id::text as id, slug, name, write_key as "writeKey"
      from inserted
    `) as { id: string; slug: string; name: string; writeKey: string }[];

    const row = rows[0];
    if (!row) throw new Error("insert returned no row");

    console.log("Created project:");
    console.log(`  id:        ${row.id}`);
    console.log(`  slug:      ${row.slug}`);
    console.log(`  name:      ${row.name}`);
    console.log(`  owner:     ${ownerEmail}`);
    console.log(`  write_key: ${row.writeKey}`);
    console.log("\nDrop this write key into your tracker init.");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      console.error(`a project with slug "${slug}" already exists`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
