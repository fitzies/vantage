import { z } from "zod";

/** Hard caps. Tuned for "small JSON event", not "arbitrary blob". */
export const MAX_BODY_BYTES = 256 * 1024; // 256 KB total request body
export const MAX_PROPS_BYTES = 32 * 1024; // 32 KB per event's props blob
export const MAX_BATCH = 100; // events per request
export const MAX_EVENT_NAME = 256; // chars
export const MAX_EVENT_ID = 128; // chars

/** Server clamps client clocks to this window around now. */
export const FUTURE_SKEW_MS = 5 * 60 * 1000; // +5 min
export const PAST_SKEW_MS = 7 * 24 * 60 * 60 * 1000; // -7 days

/**
 * Permissive timestamp coercion — apps in the wild send ISO strings,
 * epoch ms, or epoch seconds. Anything we can't parse rejects.
 */
const timestampSchema = z
  .union([z.string(), z.number(), z.date()])
  .transform((v, ctx) => {
    let d: Date;
    if (v instanceof Date) {
      d = v;
    } else if (typeof v === "number") {
      // Heuristic: < 10^12 → seconds, else ms.
      d = new Date(v < 1e12 ? v * 1000 : v);
    } else {
      const asNum = Number(v);
      d = Number.isFinite(asNum)
        ? new Date(asNum < 1e12 ? asNum * 1000 : asNum)
        : new Date(v);
    }
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "invalid timestamp" });
      return z.NEVER;
    }
    return d;
  });

/**
 * Wire format for a single event.
 *
 * Schema-on-read: `props` is free-form. We bound its serialized size in
 * `assertPropsSize` rather than constraining shape here.
 */
export const eventInputSchema = z.object({
  event: z.string().min(1).max(MAX_EVENT_NAME),
  /** Client-generated idempotency key. Used by durable/offline SDK queues. */
  event_id: z.string().max(MAX_EVENT_ID).nullish(),
  user_id: z.string().max(256).nullish(),
  anon_id: z.string().max(128).nullish(),
  session_id: z.string().max(128).nullish(),
  timestamp: timestampSchema.optional(),
  url: z.string().max(2048).nullish(),
  referrer: z.string().max(2048).nullish(),
  user_agent: z.string().max(1024).nullish(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * Request body: either a single event or `{ events: [...] }`.
 * Both forms may carry a `key` field (sendBeacon can't set headers, so
 * the tracker falls back to embedding the write key in the payload).
 */
export const requestBodySchema = z.union([
  eventInputSchema.extend({ key: z.string().optional() }),
  z.object({
    key: z.string().optional(),
    events: z.array(eventInputSchema).min(1).max(MAX_BATCH),
  }),
]);

export type RequestBody = z.infer<typeof requestBodySchema>;

/**
 * Pull a write key from header (`x-vantage-key`) or body (`key`).
 * Header wins — only sendBeacon needs the body fallback.
 */
export function extractWriteKey(
  headerKey: string | null | undefined,
  body: RequestBody,
): string | null {
  if (typeof headerKey === "string" && headerKey.length > 0) return headerKey;
  if ("key" in body && typeof body.key === "string" && body.key.length > 0) {
    return body.key;
  }
  return null;
}

/** Normalize the body into a flat list of events for the insert path. */
export function eventsFromBody(body: RequestBody): EventInput[] {
  if ("events" in body) return body.events;
  // single-event form has the same fields as eventInputSchema
  const { key: _key, ...evt } = body as RequestBody & { key?: string };
  return [evt as EventInput];
}

/**
 * Clamp a client-supplied timestamp to a sane window around `now`.
 * Defaults to `now` when missing. Returns ms-resolution Date.
 */
export function clampTimestamp(input: Date | undefined, now = Date.now()): Date {
  if (!input) return new Date(now);
  const t = input.getTime();
  if (t > now + FUTURE_SKEW_MS) return new Date(now + FUTURE_SKEW_MS);
  if (t < now - PAST_SKEW_MS) return new Date(now - PAST_SKEW_MS);
  return new Date(t);
}

/**
 * Reject events with oversized props before we hand them to the DB.
 * Counted in serialized bytes — a 32 KB cap on `props` keeps the wide
 * jsonb column from absorbing accidental dumps.
 */
export function assertPropsSize(props: unknown): void {
  if (props === undefined || props === null) return;
  const str = JSON.stringify(props);
  if (Buffer.byteLength(str, "utf8") > MAX_PROPS_BYTES) {
    const err = new Error("props_too_large");
    (err as Error & { status?: number }).status = 413;
    throw err;
  }
}
