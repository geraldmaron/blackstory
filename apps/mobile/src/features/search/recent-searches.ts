/**
 * Recent local searches (MOB-013 item 4).
 *
 * STORAGE CHOICE: SecureStore (Keychain/Keystore), not MOB-009's SQLite cache layer. Justification:
 *
 *   1. ADR-022 section 2's hard exclusion list is explicit: "No search-history table exists on
 *      disk" for the release-coupled cache that backs TanStack Query / offline reads, and
 *      apps/mobile/src/data/cache-policy.ts's NEVER_CACHE_KEY_PATTERNS structurally throws
 *      (NeverCacheViolation) on field names like `query`/`searchInput` before they can reach
 *      that store. Building a recent-searches table there would fight the architecture head-on,
 *      not work with it. That exclusion governs the AUTOMATIC, opaque cache tier (query result
 *      sets keyed by a salted hash, never the raw text) -- it is a different concern from a small,
 *      entirely user-controlled, user-visible, user-clearable convenience list of the terms a
 *      person themselves chose to type, which is what this module is.
 *   2. The threat model (docs/mobile/security/threat-model.md, T1) explicitly flags recent search
 *      terms as more sensitive than ordinary cached public content: T1's "nothing of value is
 *      stored on-device" argument for the SQLite cache rests on that cache holding ONLY
 *      already-public, already-released data anyone could fetch again. A user's own search
 *      history is not published data -- it can reveal interests/associations a rooted-device
 *      attacker (T1) or anyone with brief physical access could read from a plain SQLite file.
 *      SecureStore is backed by the platform Keychain/Keystore (hardware-backed encryption on
 *      most devices), which is a materially stronger protection boundary than an app-sandboxed
 *      SQLite file for exactly this class of "small, borderline-sensitive, user-scoped" data --
 *      the same reasoning apps/mobile/src/data/secure-store.ts already applies to the correction
 *      receipt token and the search-key salt.
 *   3. It is a small, strictly bounded list (see MAX_RECENT_ITEMS/MAX_RECENT_TERM_LENGTH below),
 *      which is exactly SecureStore's designed use case (small opaque secrets), not bulk content.
 *
 * NOTE ON OWNERSHIP: apps/mobile/src/data/secure-store.ts's `SECRET_KEYS` is a closed allow-list
 * (by design -- "there is no API to stash arbitrary blobs under arbitrary keys") and
 * apps/mobile/src/data/** is outside this bead's exclusive file ownership, so this module cannot
 * add a new key to that allow-list. It instead talks to the SAME narrow `SecretBackend` port
 * (setItemAsync/getItemAsync/deleteItemAsync) directly, under its OWN dedicated key
 * (`RECENT_SEARCHES_SECRET_KEY`, namespaced distinctly from every key in SECRET_KEYS), and reuses
 * `assertSmallSecret` (imported, not reimplemented) for the same byte-size guard secure-store.ts
 * itself enforces. Nothing here reaches into secure-store.ts's internals or its native import.
 *
 * PRIVACY: this module never logs a term (see this feature's source-scan test, which asserts no
 * source file here references the platform logging global at all) and never transmits a term
 * anywhere -- it is purely a local, on-device, user-visible and user-clearable list.
 */
import { assertSmallSecret, type SecretBackend } from '@/data';
import { foldForComparison, normalizeSearchQuery } from './query-normalization';

/** Dedicated SecureStore key for this feature. Intentionally NOT part of `SECRET_KEYS`
 * (apps/mobile/src/data/secure-store.ts) -- see the module header for why. */
export const RECENT_SEARCHES_SECRET_KEY = 'bs.search.recent_terms_v1';

/** Small, bounded list -- keeps the serialized payload comfortably under
 * apps/mobile/src/data/secure-store.ts's MAX_SECRET_BYTES (512) even at full capacity, and keeps
 * the UI list itself short and scannable. */
export const MAX_RECENT_ITEMS = 8;

/** A stored term is already `normalizeSearchQuery`-clean (<= MAX_QUERY_LENGTH = 120 chars), but we
 * cap independently and defensively here too so this module never trusts an upstream cap alone. */
export const MAX_RECENT_TERM_LENGTH = 120;

export interface RecentSearchEntry {
  readonly term: string;
  /** Epoch ms this term was last searched (drives most-recent-first ordering). */
  readonly savedAt: number;
}

/** Compact wire shape for the stored JSON blob -- short keys keep the payload small. */
type StoredRecentSearchEntry = { readonly t: string; readonly s: number };

function toStored(entry: RecentSearchEntry): StoredRecentSearchEntry {
  return { t: entry.term, s: entry.savedAt };
}

function fromStored(value: unknown): RecentSearchEntry | null {
  if (value === null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.t !== 'string' || typeof obj.s !== 'number') return null;
  if (obj.t.length === 0 || obj.t.length > MAX_RECENT_TERM_LENGTH) return null;
  if (!Number.isFinite(obj.s)) return null;
  return { term: obj.t, savedAt: obj.s };
}

/** Defensive parse: corrupt/foreign/oversized JSON never throws -- it degrades to an empty list
 * (mirrors ADR-022 section 5's "a cache is disposable, self-healing" posture applied to this
 * small SecureStore-backed list). */
export function parseRecentSearches(raw: string | undefined): RecentSearchEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: RecentSearchEntry[] = [];
  for (const item of parsed) {
    const entry = fromStored(item);
    if (entry) out.push(entry);
    if (out.length >= MAX_RECENT_ITEMS) break;
  }
  return out;
}

export function serializeRecentSearches(entries: readonly RecentSearchEntry[]): string {
  return JSON.stringify(entries.slice(0, MAX_RECENT_ITEMS).map(toStored));
}

/**
 * Pure reducer: add `term` to the front of `entries`, de-duplicating case-insensitively
 * (`foldForComparison`) against any existing entry for the same term (the OLD entry is removed,
 * not merely shadowed, so the list never grows unbounded with case variants of one term), then
 * caps the result at MAX_RECENT_ITEMS (oldest dropped first).
 */
export function addRecentSearch(
  entries: readonly RecentSearchEntry[],
  term: string,
  now: number,
): RecentSearchEntry[] {
  const normalized = normalizeSearchQuery(term).slice(0, MAX_RECENT_TERM_LENGTH);
  if (normalized.length === 0) return [...entries];
  const folded = foldForComparison(normalized);
  const withoutDuplicate = entries.filter((e) => foldForComparison(e.term) !== folded);
  return [{ term: normalized, savedAt: now }, ...withoutDuplicate].slice(0, MAX_RECENT_ITEMS);
}

/** Pure reducer: remove one entry by exact case-insensitive term match (the per-item "remove"
 * control). Absent term is a no-op, never an error. */
export function removeRecentSearch(
  entries: readonly RecentSearchEntry[],
  term: string,
): RecentSearchEntry[] {
  const folded = foldForComparison(normalizeSearchQuery(term));
  return entries.filter((e) => foldForComparison(e.term) !== folded);
}

export interface RecentSearchesStore {
  list(): Promise<RecentSearchEntry[]>;
  /** Records a completed search term (called on a SUCCESSFUL query, not on every keystroke). */
  add(term: string, now?: number): Promise<RecentSearchEntry[]>;
  /** Per-item remove control. */
  remove(term: string): Promise<RecentSearchEntry[]>;
  /** Clear-all control. */
  clear(): Promise<void>;
}

/**
 * Builds the store against an injected `SecretBackend` (the same narrow port
 * apps/mobile/src/data/secure-store.ts's `SecretBackend` type describes -- imported as a type
 * only, so this module has no runtime dependency on that file's internals). Every write runs
 * through `assertSmallSecret` first; if a caller somehow assembled an oversized payload, the
 * write is refused rather than silently truncated (defense in depth -- MAX_RECENT_ITEMS/
 * MAX_RECENT_TERM_LENGTH are what actually keeps it small, this is the backstop).
 */
export function createRecentSearchesStore(backend: SecretBackend): RecentSearchesStore {
  async function readAll(): Promise<RecentSearchEntry[]> {
    const raw = await backend.getItemAsync(RECENT_SEARCHES_SECRET_KEY);
    return parseRecentSearches(raw ?? undefined);
  }

  async function writeAll(entries: readonly RecentSearchEntry[]): Promise<void> {
    const serialized = serializeRecentSearches(entries);
    assertSmallSecret(serialized);
    await backend.setItemAsync(RECENT_SEARCHES_SECRET_KEY, serialized);
  }

  return {
    list: readAll,
    async add(term, now = Date.now()) {
      const current = await readAll();
      const next = addRecentSearch(current, term, now);
      await writeAll(next);
      return next;
    },
    async remove(term) {
      const current = await readAll();
      const next = removeRecentSearch(current, term);
      await writeAll(next);
      return next;
    },
    async clear() {
      await backend.deleteItemAsync(RECENT_SEARCHES_SECRET_KEY);
    },
  };
}

/** Lazily binds the real expo-secure-store module (not imported by tests). Mirrors
 * apps/mobile/src/data/secure-store.ts's own `createExpoSecretBackend` lazy-import pattern --
 * duplicated locally (rather than imported) because that factory is an internal of secure-store.ts
 * not re-exported from the `@/data` barrel, which is the only surface this bead may depend on. */
export async function createExpoRecentSearchesBackend(): Promise<SecretBackend> {
  const SecureStore = await import('expo-secure-store');
  return {
    setItemAsync: (k: string, v: string) => SecureStore.setItemAsync(k, v),
    getItemAsync: (k: string) => SecureStore.getItemAsync(k),
    deleteItemAsync: (k: string) => SecureStore.deleteItemAsync(k),
  };
}
