/**
 * Vantage — Expo / React Native tracker.
 *
 * No React Native or Expo modules are imported here. Apps pass their own
 * AsyncStorage adapter and optional device/app context so this package stays
 * small and works in managed Expo, bare RN, and tests.
 */

export type EventProps = Record<string, unknown>;

export interface WireEvent {
  event: string;
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

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface MobileContext {
  platform?: "ios" | "android" | "web" | "expo" | string;
  appVersion?: string | null;
  buildNumber?: string | null;
  osVersion?: string | null;
  deviceModel?: string | null;
  locale?: string | null;
}

export interface InitOptions {
  project: string;
  writeKey: string;
  endpoint: string;
  storage?: StorageAdapter;
  context?: MobileContext | (() => MobileContext | Promise<MobileContext>);
  debug?: boolean;
  /** Default true: emits app_first_open once and app_open on init. */
  autoLifecycleEvents?: boolean;
  /** Default 30 minutes. A foreground after this starts a new session. */
  sessionTimeoutMs?: number;
  /** Default 1000ms. */
  flushIntervalMs?: number;
  /** Default 20. Server max is 100. */
  flushAtCount?: number;
}

const MAX_BATCH = 100;
const MAX_BODY_BYTES = 220 * 1024; // leave room under the server's 256KB cap
const MAX_QUEUE = 1000;
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const memoryStore = new Map<string, string>();
const memoryStorage: StorageAdapter = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

interface State {
  initialized: boolean;
  project: string;
  writeKey: string;
  endpoint: string;
  storage: StorageAdapter;
  context: InitOptions["context"];
  debug: boolean;
  sessionTimeoutMs: number;
  flushIntervalMs: number;
  flushAtCount: number;
  userId: string | null;
  anonId: string;
  sessionId: string;
  previousAnonId: string | null;
  queue: WireEvent[];
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
  lastBackgroundedAt: number | null;
}

const state: State = {
  initialized: false,
  project: "",
  writeKey: "",
  endpoint: "",
  storage: memoryStorage,
  context: undefined,
  debug: false,
  sessionTimeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
  flushIntervalMs: 1000,
  flushAtCount: 20,
  userId: null,
  anonId: "",
  sessionId: "",
  previousAnonId: null,
  queue: [],
  timer: null,
  flushing: false,
  lastBackgroundedAt: null,
};

function log(...args: unknown[]): void {
  if (state.debug) console.debug("[vantage-expo]", ...args);
}

function storageKey(name: string): string {
  const project = state.project || "default";
  return `vntg:${project}:${name}`;
}

async function getStored(key: string): Promise<string | null> {
  try {
    return await state.storage.getItem(key);
  } catch (err) {
    log("storage get failed", key, err);
    return null;
  }
}

async function setStored(key: string, value: string): Promise<void> {
  try {
    await state.storage.setItem(key, value);
  } catch (err) {
    log("storage set failed", key, err);
  }
}

async function removeStored(key: string): Promise<void> {
  try {
    await state.storage.removeItem(key);
  } catch (err) {
    log("storage remove failed", key, err);
  }
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c && "randomUUID" in c
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadQueue(): Promise<WireEvent[]> {
  const raw = await getStored(storageKey("queue"));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WireEvent[]).slice(0, MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

async function persistQueue(): Promise<void> {
  const bounded = state.queue.slice(-MAX_QUEUE);
  state.queue = bounded;
  await setStored(storageKey("queue"), JSON.stringify(bounded));
}

async function getContextProps(): Promise<EventProps> {
  const value =
    typeof state.context === "function" ? await state.context() : state.context;
  return {
    project: state.project,
    platform: value?.platform ?? "expo",
    app_version: value?.appVersion ?? null,
    build_number: value?.buildNumber ?? null,
    os_version: value?.osVersion ?? null,
    device_model: value?.deviceModel ?? null,
    locale: value?.locale ?? null,
    sdk_name: "vantage-expo",
    sdk_type: "native_mobile",
    sdk_version: "0.1.0",
  };
}

async function buildEvent(name: string, props?: EventProps): Promise<WireEvent> {
  const finalProps: EventProps = {
    ...(await getContextProps()),
    ...(props ?? {}),
  };

  if (state.previousAnonId) {
    finalProps.previous_anon_id = state.previousAnonId;
    state.previousAnonId = null;
  }

  return {
    event: name,
    event_id: newId(),
    user_id: state.userId,
    anon_id: state.anonId,
    session_id: state.sessionId,
    timestamp: new Date().toISOString(),
    props: finalProps,
  };
}

function scheduleFlush(): void {
  if (state.timer || state.queue.length === 0) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    void flush();
  }, state.flushIntervalMs);
}

function byteLength(value: string): number {
  // TextEncoder exists in RN/Hermes and modern JS runtimes.
  return new TextEncoder().encode(value).length;
}

function takeBatch(queue: WireEvent[]): WireEvent[] {
  const batch: WireEvent[] = [];
  for (const event of queue) {
    if (batch.length >= Math.min(state.flushAtCount, MAX_BATCH)) break;
    const next = [...batch, event];
    const bytes = byteLength(JSON.stringify({ key: state.writeKey, events: next }));
    if (batch.length > 0 && bytes > MAX_BODY_BYTES) break;
    batch.push(event);
  }
  return batch;
}

async function sendBatch(events: WireEvent[]): Promise<"ok" | "retry" | "drop"> {
  try {
    const res = await fetch(state.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vantage-key": state.writeKey,
      },
      body: JSON.stringify({ key: state.writeKey, events }),
    });
    if (res.ok) return "ok";
    log("non-ok response", res.status);
    return res.status >= 400 && res.status < 500 ? "drop" : "retry";
  } catch (err) {
    log("send failed", err);
    return "retry";
  }
}

async function enqueue(event: WireEvent): Promise<void> {
  state.queue.push(event);
  if (state.queue.length > MAX_QUEUE) state.queue.splice(0, state.queue.length - MAX_QUEUE);
  await persistQueue();
  if (state.queue.length >= state.flushAtCount) {
    await flush();
  } else {
    scheduleFlush();
  }
}

export async function init(options: InitOptions): Promise<void> {
  if (state.initialized) {
    log("init called more than once");
    return;
  }
  if (!options.project || !options.writeKey || !options.endpoint) {
    throw new Error("[vantage-expo] init requires { project, writeKey, endpoint }");
  }

  state.project = options.project;
  state.writeKey = options.writeKey;
  state.endpoint = options.endpoint;
  state.storage = options.storage ?? memoryStorage;
  state.context = options.context;
  state.debug = Boolean(options.debug);
  state.sessionTimeoutMs = options.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
  state.flushIntervalMs = options.flushIntervalMs ?? 1000;
  state.flushAtCount = Math.min(options.flushAtCount ?? 20, MAX_BATCH);

  state.anonId = (await getStored(storageKey("anon"))) ?? newId();
  await setStored(storageKey("anon"), state.anonId);
  state.userId = await getStored(storageKey("user"));
  state.sessionId = newId();
  state.queue = await loadQueue();
  state.initialized = true;

  if (options.autoLifecycleEvents !== false) {
    const firstOpenKey = storageKey("first_open_sent");
    const firstOpenSent = await getStored(firstOpenKey);
    if (!firstOpenSent) {
      await track("app_first_open");
      await setStored(firstOpenKey, "1");
    }
    await track("app_open");
  }

  scheduleFlush();
}

export async function track(event: string, props?: EventProps): Promise<void> {
  if (!state.initialized) {
    log("track called before init", event);
    return;
  }
  await enqueue(await buildEvent(event, props));
}

export async function screen(name: string, props?: EventProps): Promise<void> {
  await track("screen_view", { ...(props ?? {}), screen: name });
}

export async function identify(userId: string, traits?: EventProps): Promise<void> {
  if (!state.initialized) return;
  state.previousAnonId = state.anonId;
  state.userId = userId;
  await setStored(storageKey("user"), userId);
  await enqueue(
    await buildEvent("$identify", {
      ...(traits ?? {}),
      previous_anon_id: state.previousAnonId,
    }),
  );
  state.previousAnonId = null;
}

export async function reset(): Promise<void> {
  if (!state.initialized) return;
  await flush();
  state.userId = null;
  state.previousAnonId = null;
  state.anonId = newId();
  state.sessionId = newId();
  await setStored(storageKey("anon"), state.anonId);
  await removeStored(storageKey("user"));
}

export async function handleAppStateChange(nextState: string): Promise<void> {
  if (!state.initialized) return;
  if (nextState === "background" || nextState === "inactive") {
    state.lastBackgroundedAt = Date.now();
    await track("app_background");
    await flush();
    return;
  }
  if (nextState === "active") {
    if (
      state.lastBackgroundedAt &&
      Date.now() - state.lastBackgroundedAt > state.sessionTimeoutMs
    ) {
      state.sessionId = newId();
    }
    state.lastBackgroundedAt = null;
    await track("app_foreground");
  }
}

export async function flush(): Promise<void> {
  if (!state.initialized || state.flushing || state.queue.length === 0) return;
  state.flushing = true;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  try {
    while (state.queue.length > 0) {
      const batch = takeBatch(state.queue);
      state.queue.splice(0, batch.length);
      await persistQueue();

      const result = await sendBatch(batch);
      if (result === "ok" || result === "drop") continue;

      state.queue = [...batch, ...state.queue].slice(0, MAX_QUEUE);
      await persistQueue();
      break;
    }
  } finally {
    state.flushing = false;
    scheduleFlush();
  }
}

export function getAnonymousId(): string | null {
  return state.initialized ? state.anonId : null;
}

export function getSessionId(): string | null {
  return state.initialized ? state.sessionId : null;
}
