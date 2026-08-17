/**
 * Public types for the Vantage browser tracker.
 */

export type EventProps = Record<string, unknown>;

export interface InitOptions {
  /**
   * Project slug. Sent on every event as `props.project` so the server
   * can sanity-check against the write key's resolved project.
   */
  project: string;
  /** Public write key. Identifies the project; not a secret. */
  writeKey: string;
  /**
   * Override the capture endpoint. Defaults to `/api/events` (same-origin).
   * Required when the tracker runs on a different origin than Vantage.
   */
  endpoint?: string;
  /**
   * If true, the tracker auto-enables pageview tracking — but you still
   * need `<VantagePageview/>` mounted to actually fire on route changes.
   * Default: `false` (opt in via the component).
   */
  autoPageview?: boolean;
  /** Log to console.debug instead of swallowing failures. */
  debug?: boolean;
}

/** Wire-format event the tracker sends. Matches `eventInputSchema` server-side. */
export interface WireEvent {
  event: string;
  /** Client-generated idempotency key for safe retries/offline queues. */
  event_id?: string | null;
  user_id?: string | null;
  anon_id?: string | null;
  session_id?: string | null;
  timestamp: string;
  url?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  props?: EventProps;
}
