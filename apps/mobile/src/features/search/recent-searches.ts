/**
 * Recent local searches (MOB-013 item 4).
 *
 * STORAGE CHOICE: SecureStore (Keychain/Keystore), not MOB-009's SQLite cache layer. This is a
 * DELIBERATE, RECORDED EXCEPTION to program invariant 7 (see docs/decisions-carryover.md,
 * "Addendum, 2026-09-12 (repo-30k6)" -- read that first; this comment summarizes it) --
 * invariant 7's original text ("no query text ... may reach ... the on-disk cache") and its
 * rejected-alternatives table both read as a blanket ban on persisting query text at all, with
 * no carve-out for a small user-controlled list. The owner reviewed that primary text directly
 * and approved this exception anyway, WITH the control this file implements
 * (see search-runtime.ts's clearRecentSearchesOnFreshInstall). Do not re-litigate this as an
 * accident or a citation bug -- it is a considered, recorded departure. Justification:
 *
 *   1. This is a different concern from the automatic, opaque cache tier invariant 7 was
 *      written to constrain (query result sets keyed by a salted hash, never raw text --
 *      apps/mobile/src/data/cache-policy.ts's NEVER_CACHE_KEY_PATTERNS still structurally
 *      forbids that tier from ever seeing raw query text). This module is a small, entirely
 *      user-controlled, user-visible, user-clearable convenience list of terms a person
 *      themselves chose to type -- not an automatic record of everything searched.
 *   2. SecureStore is backed by the platform Keychain/Keystore (hardware-backed encryption on
 *      most devices), a materially stronger protection boundary than an app-sandboxed SQLite
 *      file for this class of small, user-scoped data -- the same reasoning
 *      apps/mobile/src/data/secure-store.ts already applies to the correction receipt token and
 *      the search-key salt. (NOTE: docs/mobile/security/threat-model.md's T1 does NOT discuss
 *      search-term sensitivity anywhere -- an earlier version of this comment incorrectly
 *      claimed it did. The "a user's search terms can be more revealing than public data" point
 *      above is this module's own reasoning, not a cited threat-model finding.)
 *   3. The residual risk this exception carries -- iOS Keychain items survive app deletion,
 *      so a straight SecureStore carve-out alone would let a "deleted and reinstalled" user's
 *      old search terms silently reappear -- is closed by search-runtime.ts clearing this key
 *      on the first launch of a fresh install (detected via a SQLite meta flag, which IS wiped
 *      on uninstall on both platforms).
 *   4. It is a small, strictly bounded list (see MAX_RECENT_ITEMS/MAX_RECENT_TERM_LENGTH below),
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
 * (mirrors ADR-023 section 5's "a cache is disposable, self-healing" posture applied to this
 * small SecureStore-backed list; ADR-023 was removed in the 2026-07-24 purge and is restated
 * in `docs/decisions-carryover.md`, "Mobile cache and OTA release"). */
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
