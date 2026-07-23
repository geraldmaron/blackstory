/**
 * Atomic read/write helpers for Phase 1 EJI/TRI live download cache files.
 * Avoids TOCTOU races by using try-read and exclusive (wx) writes instead of exists-then-write.
 */
import { readFileSync, writeFileSync } from 'node:fs';

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

export function readCacheTextIfPresent(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
}

export function readCacheJsonIfPresent<T>(path: string): T | null {
  const text = readCacheTextIfPresent(path);
  return text === null ? null : (JSON.parse(text) as T);
}

export function writeCacheTextExclusive(path: string, contents: string): boolean {
  try {
    writeFileSync(path, contents, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) {
      return false;
    }
    throw error;
  }
}

export function writeCacheJsonExclusive(path: string, value: unknown): boolean {
  return writeCacheTextExclusive(path, JSON.stringify(value));
}

export async function readOrFetchCacheText(
  path: string,
  fetch: () => Promise<string>,
): Promise<string> {
  const cached = readCacheTextIfPresent(path);
  if (cached !== null) {
    return cached;
  }
  const fetched = await fetch();
  if (writeCacheTextExclusive(path, fetched)) {
    return fetched;
  }
  return readCacheTextIfPresent(path) ?? fetched;
}

export async function readOrFetchCacheJson<T extends Record<string, unknown>>(
  path: string,
  fetch: () => Promise<readonly T[]>,
): Promise<readonly T[]> {
  const cached = readCacheJsonIfPresent<readonly T[]>(path);
  if (cached !== null) {
    return cached;
  }
  const fetched = await fetch();
  if (writeCacheJsonExclusive(path, fetched)) {
    return fetched;
  }
  return readCacheJsonIfPresent<readonly T[]>(path) ?? fetched;
}
