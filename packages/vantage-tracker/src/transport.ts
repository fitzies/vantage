import type { WireEvent } from "./types";

interface SendOptions {
  endpoint: string;
  writeKey: string;
  events: WireEvent[];
  /**
   * When true, prefer `sendBeacon` (fire-and-forget, survives unload).
   * Used during `visibilitychange === "hidden"` and `pagehide`.
   */
  unloading?: boolean;
  debug?: boolean;
}

/**
 * Send a batch.
 *
 * The transport tries hard to deliver:
 *   1. If `unloading` and `sendBeacon` is available, use it.
 *   2. Otherwise `fetch(..., { keepalive: true })` so in-flight requests
 *      survive a navigation.
 *   3. On fetch failure, retry once after a short backoff.
 *
 * sendBeacon is fire-and-forget by spec — there's no response code to
 * inspect, so we don't retry it. Worst case the event is lost; that's an
 * acceptable trade for "fires reliably during unload".
 */
export async function send(options: SendOptions): Promise<void> {
  const { endpoint, writeKey, events, unloading, debug } = options;
  const payload = JSON.stringify({ key: writeKey, events });

  if (unloading && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      // Beacons can't set headers, so the key rides in the body.
      // The server accepts both forms.
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return;
      // Fall through to fetch on beacon refusal (e.g. quota exceeded).
    } catch (err) {
      if (debug) console.debug("[vantage] sendBeacon threw", err);
    }
  }

  const init: RequestInit = {
    method: "POST",
    keepalive: true,
    headers: {
      "content-type": "application/json",
      "x-vantage-key": writeKey,
    },
    body: payload,
    // Don't carry cookies cross-origin — the write key is the auth.
    credentials: "omit",
    mode: "cors",
  };

  try {
    const res = await fetch(endpoint, init);
    if (res.ok) return;
    if (debug) console.debug("[vantage] fetch non-ok", res.status);
  } catch (err) {
    if (debug) console.debug("[vantage] fetch failed", err);
  }

  // One retry, short backoff. If the page is unloading we shouldn't be
  // here — retries during unload are pointless without sendBeacon.
  if (unloading) return;

  await new Promise((r) => setTimeout(r, 250));
  try {
    const res = await fetch(endpoint, init);
    if (!res.ok && debug) console.debug("[vantage] retry non-ok", res.status);
  } catch (err) {
    if (debug) console.debug("[vantage] retry failed", err);
  }
}
