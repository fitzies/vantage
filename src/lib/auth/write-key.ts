import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";

/**
 * Resolve a public write key to a project_id.
 *
 * The hot path (warm function, repeated requests with the same key) is a
 * single Map lookup. Misses fall through to a DB query and are cached for
 * `TTL_MS`. Negative results (unknown keys) are also cached briefly so a
 * spammer can't hammer the DB with bad keys.
 *
 * Cache lives on the module — Fluid Compute reuses function instances
 * across concurrent requests, so this stays warm between invocations.
 */
const TTL_MS = 60_000;
const NEG_TTL_MS = 10_000;
const MAX_ENTRIES = 1024;

interface CacheEntry {
  /** null = negative cache (unknown key). */
  projectId: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function setCache(key: string, projectId: string | null) {
  // Naive LRU-ish: when full, drop the oldest insertion.
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, {
    projectId,
    expiresAt: Date.now() + (projectId ? TTL_MS : NEG_TTL_MS),
  });
}

/**
 * @returns the project_id, or `null` if the key is unknown.
 */
export async function resolveWriteKey(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.projectId;
  }

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.writeKey, key))
    .limit(1);

  const projectId = rows[0]?.id ?? null;
  setCache(key, projectId);
  return projectId;
}

/** Test/admin hook — clears the cache (e.g. after rotating a key). */
export function clearWriteKeyCache(): void {
  cache.clear();
}
