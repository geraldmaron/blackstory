/**
 * SecureStore usage, strictly bounded (MOB-009 §7; `docs/decisions-carryover.md`, "Mobile data
 * boundary" for the guard analysis, "Mobile cache and OTA release" for the never-cache list).
 *
 * SecureStore (Keychain / Keystore) is for SMALL OPAQUE SECRETS ONLY — e.g. a
 * correction receipt code (MOB-016) or the per-install search-key salt
 * (cache-policy.hashSearchKey). Bulk cached CONTENT must never go here; it goes
 * in SQLite (`docs/decisions-carryover.md`, "Mobile stack": SQLite is the cache engine, and
 * "Mobile cache and OTA release"). Two guards are named here, and only the first is a runtime
 * control:
 *   - A hard byte cap (`MAX_SECRET_BYTES`), enforced by `assertSmallSecret` before any write
 *     reaches the backend. expo-secure-store itself warns above ~2 KB on Android; we cap well
 *     under it and REJECT rather than truncate.
 *   - A closed allow-list of secret keys (`SecretKey`). This constrains THIS module's API and
 *     nothing else: `features/search/recent-searches.ts` writes its own key straight to the
 *     `SecretBackend` port under the carve-out recorded in `docs/decisions-carryover.md`,
 *     "Addendum, 2026-09-12 (repo-30k6)". It is not a guarantee about what reaches the keychain.
 *
 * The size guard is a pure function so it is unit-tested with no native module.
 */
import { utf8ByteLength } from './hashing';

/** Small — a receipt code or a salt, never content. */
export const MAX_SECRET_BYTES = 512;

/** The ONLY keys permitted in SecureStore. Bulk data has no entry here. */
export const SECRET_KEYS = {
  /** Per-install salt for hashing search keys (never the query text itself). */
  searchSalt: 'bs.search_salt',
  /** Opaque correction receipt status token (MOB-016), not the correction text. */
  correctionReceipt: 'bs.correction_receipt',
} as const;

export type SecretKey = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];

export class SecretTooLargeError extends Error {
  constructor(readonly byteLength: number) {
    super(
      `secret of ${byteLength} bytes exceeds the ${MAX_SECRET_BYTES}-byte cap; ` +
        'SecureStore is for small opaque secrets only — bulk data belongs in SQLite',
    );
    this.name = 'SecretTooLargeError';
  }
}

function byteLen(value: string): number {
  return utf8ByteLength(value);
}

/** Pure guard: throws if `value` is too large to be a small secret. */
export function assertSmallSecret(value: string): void {
  const length = byteLen(value);
  if (length > MAX_SECRET_BYTES) {
    throw new SecretTooLargeError(length);
  }
}

/** The narrow native surface we depend on (subset of expo-secure-store). */
export interface SecretBackend {
  setItemAsync(key: string, value: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SecretStore {
  set(key: SecretKey, value: string): Promise<void>;
  get(key: SecretKey): Promise<string | undefined>;
  delete(key: SecretKey): Promise<void>;
}

/** Wrap a backend with the size guard. The default backend lazily imports the
 * native module (createExpoSecretBackend), so tests inject a fake. */
export function createSecretStore(backend: SecretBackend): SecretStore {
  return {
    async set(key, value) {
      assertSmallSecret(value); // reject bulk BEFORE it can reach the keychain
      await backend.setItemAsync(key, value);
    },
    async get(key) {
      return (await backend.getItemAsync(key)) ?? undefined;
    },
    async delete(key) {
      await backend.deleteItemAsync(key);
    },
  };
}

/** Lazily binds expo-secure-store. Not imported by tests. */
export async function createExpoSecretBackend(): Promise<SecretBackend> {
  const SecureStore = await import('expo-secure-store');
  return {
    setItemAsync: (k, v) => SecureStore.setItemAsync(k, v),
    getItemAsync: (k) => SecureStore.getItemAsync(k),
    deleteItemAsync: (k) => SecureStore.deleteItemAsync(k),
  };
}
