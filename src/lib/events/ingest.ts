import "server-only";
import { db } from "@/lib/db/client";
import { events, type NewEventRow } from "@/lib/db/schema";
import {
  assertPropsSize,
  clampTimestamp,
  type EventInput,
} from "./validate";

export interface IngestContext {
  /** Project the write key resolved to. */
  projectId: string;
  /** UA from request headers — used as a fallback when client didn't send one. */
  userAgent?: string | null;
  /** Stamp received_at from a single moment so a batch lands together. */
  now?: number;
}

/**
 * Insert one or more validated events. Single round trip per call.
 *
 * Fields not provided by the client default sensibly: `timestamp` falls
 * back to `now` (then clamped to ±5min/-7d), and `props` becomes `{}`.
 */
export async function ingestEvents(
  input: EventInput[],
  ctx: IngestContext,
): Promise<number> {
  if (input.length === 0) return 0;

  const now = ctx.now ?? Date.now();

  const rows: NewEventRow[] = input.map((e) => {
    assertPropsSize(e.props);
    return {
      projectId: ctx.projectId,
      event: e.event,
      eventId: e.event_id ?? null,
      userId: e.user_id ?? null,
      anonId: e.anon_id ?? null,
      sessionId: e.session_id ?? null,
      timestamp: clampTimestamp(e.timestamp, now),
      url: e.url ?? null,
      referrer: e.referrer ?? null,
      userAgent: e.user_agent ?? ctx.userAgent ?? null,
      props: e.props ?? {},
    };
  });

  const inserted = await db
    .insert(events)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: events.id });
  return inserted.length;
}
