/**
 * Vantage — browser tracker.
 *
 * Public API:
 *   init({ project, writeKey, endpoint?, autoPageview?, debug? })
 *   track(event, props?)
 *   identify(userId, traits?)
 *   page(url?, props?)
 *   reset()
 *
 * Design constraints:
 *   - Zero deps in this entry; React lives at `@ojflabs/vantage/react`.
 *   - Buffer events: 1s window OR 20-event cap, whichever first.
 *   - Force flush on `visibilitychange === "hidden"` and `pagehide`.
 *   - Identity stitching is at query time via `props.previous_anon_id`.
 */
import { getAnonId, resetAnonId, setAnonId } from "./anon";
import { send } from "./transport";
import type { EventProps, InitOptions, WireEvent } from "./types";

export type { EventProps, InitOptions, WireEvent } from "./types";

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_AT_COUNT = 20;
const SESSION_KEY = "vntg_sid";

interface State {
  initialized: boolean;
  project: string;
  writeKey: string;
  endpoint: string;
  debug: boolean;
  userId: string | null;
  /** anon_id captured at last identify() — emitted once on the next event. */
  previousAnonId: string | null;
  sessionId: string;
  queue: WireEvent[];
  timer: ReturnType<typeof setTimeout> | null;
}

const state: State = {
  initialized: false,
  project: "",
  writeKey: "",
  endpoint: "/api/events",
  debug: false,
  userId: null,
  previousAnonId: null,
  sessionId: "",
  queue: [],
  timer: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getOrCreateSessionId(): string {
  // sessionStorage gives us a tab-scoped session, which matches what most
  // analytics tools call a "session" — survives reloads, dies on tab close.
  try {
    const existing = window.sessionStorage?.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage?.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function scheduleFlush(): void {
  if (state.timer || state.queue.length === 0) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function flush(unloading = false): void {
  if (!state.initialized) return;
  if (state.queue.length === 0) return;
  const batch = state.queue.splice(0, state.queue.length);
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  // Fire and forget — we never await flush, even on the unload path.
  // The transport layer handles keepalive / sendBeacon for reliability.
  void send({
    endpoint: state.endpoint,
    writeKey: state.writeKey,
    events: batch,
    unloading,
    debug: state.debug,
  });
}

function bindUnloadHandlers(): void {
  // visibilitychange fires more reliably than pagehide on mobile Safari
  // and is the recommended primary signal; pagehide is a belt-and-braces.
  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => flush(true));
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEvent(name: string, props?: EventProps): WireEvent {
  const finalProps: EventProps = {
    project: state.project,
    platform: "web",
    sdk_name: "vantage-tracker",
    sdk_type: "web",
    sdk_version: "0.1.0",
    ...(props ?? {}),
  };
  if (state.previousAnonId) {
    finalProps.previous_anon_id = state.previousAnonId;
    state.previousAnonId = null; // emit once, then forget
  }
  const isB = isBrowser();
  return {
    event: name,
    event_id: newId(),
    user_id: state.userId,
    anon_id: getAnonId(),
    session_id: state.sessionId,
    timestamp: new Date().toISOString(),
    url: isB ? window.location.href : null,
    referrer: isB ? document.referrer || null : null,
    user_agent: isB ? navigator.userAgent : null,
    props: finalProps,
  };
}

function enqueue(evt: WireEvent): void {
  state.queue.push(evt);
  if (state.queue.length >= FLUSH_AT_COUNT) {
    flush();
    return;
  }
  scheduleFlush();
}

/* ---------- public API ---------- */

export function init(options: InitOptions): void {
  if (state.initialized) {
    if (state.debug) console.debug("[vantage] init called more than once");
    return;
  }
  if (!options.project || !options.writeKey) {
    throw new Error("[vantage] init requires { project, writeKey }");
  }
  state.project = options.project;
  state.writeKey = options.writeKey;
  state.endpoint = options.endpoint ?? "/api/events";
  state.debug = Boolean(options.debug);
  state.initialized = true;

  if (isBrowser()) {
    state.sessionId = getOrCreateSessionId();
    bindUnloadHandlers();
  }
}

export function track(event: string, props?: EventProps): void {
  if (!state.initialized) {
    if (state.debug) console.debug("[vantage] track called before init");
    return;
  }
  enqueue(buildEvent(event, props));
}

export function identify(userId: string, traits?: EventProps): void {
  if (!state.initialized) return;
  // Capture the pre-identify anon id so the next event can carry it as
  // `previous_anon_id` for query-time stitching.
  state.previousAnonId = getAnonId();
  state.userId = userId;
  enqueue(
    buildEvent("$identify", {
      ...(traits ?? {}),
      previous_anon_id: state.previousAnonId,
    }),
  );
  // The buildEvent call above already consumed previousAnonId — but we
  // explicitly null it for clarity since we just emitted it.
  state.previousAnonId = null;
}

export function page(url?: string, props?: EventProps): void {
  if (!state.initialized) return;
  const evt = buildEvent("$pageview", props);
  if (url) evt.url = url;
  enqueue(evt);
}

export function reset(): void {
  if (!state.initialized) return;
  flush(); // ship anything pending under the old identity first
  state.userId = null;
  state.previousAnonId = null;
  resetAnonId();
  if (isBrowser()) {
    try {
      window.sessionStorage?.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    state.sessionId = getOrCreateSessionId();
  }
}

/* ---------- test helpers (not part of the public README API) ---------- */

/** Force a synchronous flush. Useful in tests. */
export function _flushForTest(): void {
  flush();
}

/** Override the anon id (e.g. for SSR seeding). Rarely needed. */
export function _setAnonIdForTest(id: string): void {
  setAnonId(id);
}
