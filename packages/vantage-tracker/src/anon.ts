/**
 * Anonymous ID — stored in localStorage, generated lazily on first read.
 *
 * Survives reloads but not cross-device. When the user signs in, call
 * `identify(userId)` to attach a stable user_id; the tracker stamps
 * `previous_anon_id` onto the next event so identity stitching can
 * happen at query time without a server-side identities table.
 */
const STORAGE_KEY = "vntg_anon";

function safeGet(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Private mode / disabled storage — fall through to in-memory id.
    return null;
  }
}

function safeSet(value: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

let memoryFallback: string | null = null;

function newId(): string {
  // crypto.randomUUID is available in every browser we care about (and
  // in Node 19+, so this also runs fine under SSR if accidentally called).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Last-resort fallback — should never run in practice.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnonId(): string {
  const existing = safeGet() ?? memoryFallback;
  if (existing) return existing;
  const id = newId();
  safeSet(id);
  memoryFallback = id;
  return id;
}

export function setAnonId(id: string): void {
  safeSet(id);
  memoryFallback = id;
}

export function resetAnonId(): string {
  const id = newId();
  safeSet(id);
  memoryFallback = id;
  return id;
}
