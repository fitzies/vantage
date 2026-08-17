import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client backed by Neon's HTTP driver.
 *
 * HTTP transport (no pooling, no persistent connections) means this is
 * safe to import in any runtime — Node, Edge, or Fluid Compute — without
 * worrying about leaking sockets across cold starts.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
