import type { NextRequest } from "next/server";
import { resolveWriteKey } from "@/lib/auth/write-key";
import { ingestEvents } from "@/lib/events/ingest";
import {
  MAX_BODY_BYTES,
  eventsFromBody,
  extractWriteKey,
  requestBodySchema,
} from "@/lib/events/validate";

// Force Node.js runtime — explicit, even though it's the default.
// Edge would also work (Neon's HTTP driver is fetch-based) but Node
// gives us Buffer/byteLength and matches the rest of the app.
export const runtime = "nodejs";

// This endpoint is the whole point of the app on day one — never cache it.
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-vantage-key",
  "Access-Control-Max-Age": "86400",
} as const;

function jsonError(
  status: number,
  code: string,
  message?: string,
): Response {
  return new Response(
    JSON.stringify({ error: code, ...(message ? { message } : {}) }),
    {
      status,
      headers: {
        "content-type": "application/json",
        ...CORS_HEADERS,
      },
    },
  );
}

/** Browser preflight. */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Capture endpoint.
 *
 * Auth: `x-vantage-key` header (preferred) or `key` field in the body
 * (sendBeacon fallback). Keys are public — they identify a project, they
 * don't authorize a user.
 *
 * Accepts a single event or `{ events: [...] }` (max 100). Per-event
 * `props` is capped at 32 KB serialized; total body at 256 KB.
 */
export async function POST(request: NextRequest): Promise<Response> {
  // Cheap precheck — reject obviously oversized requests before reading.
  const lenHeader = request.headers.get("content-length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return jsonError(413, "payload_too_large");
    }
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "invalid_body");
  }

  // Belt-and-braces: re-check size after reading (no content-length).
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return jsonError(413, "payload_too_large");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid_json");
  }

  const parsed = requestBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(400, "invalid_schema", parsed.error.message);
  }

  const writeKey = extractWriteKey(
    request.headers.get("x-vantage-key"),
    parsed.data,
  );
  if (!writeKey) return jsonError(401, "missing_write_key");

  const projectId = await resolveWriteKey(writeKey);
  if (!projectId) return jsonError(403, "unknown_write_key");

  const inputs = eventsFromBody(parsed.data);

  try {
    await ingestEvents(inputs, {
      projectId,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 413) return jsonError(413, "props_too_large");
    console.error("[vantage] ingest failed", err);
    return jsonError(500, "ingest_failed");
  }

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
