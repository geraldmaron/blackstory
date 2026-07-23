/**
 * Cache path helpers for Phase 1 EJI/TRI live downloads under repo `.cache/phase1-eji-tri/`.
 * Cached artifacts are gitignored; committed rollups live under firebase/fixtures/.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

export const PHASE1_EJI_TRI_CACHE_DIR = join(REPO_ROOT, '.cache/phase1-eji-tri');

export function phase1EjiTriCachePath(filename: string): string {
  return join(PHASE1_EJI_TRI_CACHE_DIR, filename);
}

export function ensurePhase1EjiTriCacheDir(): void {
  mkdirSync(PHASE1_EJI_TRI_CACHE_DIR, { recursive: true });
}
