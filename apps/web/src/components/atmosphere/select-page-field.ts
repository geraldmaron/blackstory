/**
 * Pathname-based selection of transparent page-field atmosphere motifs for shell pages.
 * Map and home explore surfaces receive null so `--ds-canvas` stays unobstructed.
 */
import {
  pageFieldMotifById,
  type PageFieldMotifId,
} from './geometric-fallbacks';

export type { PageFieldMotifId };

export type PageFieldSelection = {
  readonly motifId: PageFieldMotifId;
  readonly lightPath: string;
  readonly darkPath: string;
  readonly label: string;
} | null;

/** pathname-based deterministic motif; null for map/home explore surfaces */
export function selectPageField(pathname: string): PageFieldSelection {
  const path = normalizePathname(pathname);

  if (isMapSurface(path)) {
    return null;
  }

  const motifId = resolveMotifId(path);
  const motif = pageFieldMotifById(motifId);
  return {
    motifId,
    lightPath: motif.lightPath,
    darkPath: motif.darkPath,
    label: motif.label,
  };
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.replace(/\/+$/, '') || '/';
}

function isMapSurface(path: string): boolean {
  return path === '/' || path === '/explore' || path.startsWith('/explore/');
}

function resolveMotifId(path: string): PageFieldMotifId {
  if (matchesRoutePrefix(path, '/data') || matchesRoutePrefix(path, '/facts')) {
    return 'ledger';
  }

  if (
    matchesRoutePrefix(path, '/history') ||
    matchesRoutePrefix(path, '/search') ||
    matchesRoutePrefix(path, '/entity')
  ) {
    return 'rules';
  }

  if (
    matchesRoutePrefix(path, '/stories') ||
    matchesRoutePrefix(path, '/about') ||
    matchesRoutePrefix(path, '/topics')
  ) {
    return 'bands';
  }

  if (
    matchesRoutePrefix(path, '/methodology') ||
    matchesRoutePrefix(path, '/legal') ||
    matchesRoutePrefix(path, '/myths') ||
    matchesRoutePrefix(path, '/corrections') ||
    matchesRoutePrefix(path, '/errata') ||
    matchesRoutePrefix(path, '/submit') ||
    matchesRoutePrefix(path, '/locate')
  ) {
    return 'pins';
  }

  return 'rules';
}

function matchesRoutePrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
