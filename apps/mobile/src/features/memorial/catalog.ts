/**
 * Memorial catalog loader and browse helpers for native mobile.
 */
import catalogSeed from './catalog-seed.json';
import type { MemorialCatalogSnapshot, MemorialNameEntry } from './types';

/** Replace em/en dashes in display strings (brand: no em dashes in UI copy). */
export function plainDashCopy(value: string): string {
  return value.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' to ').replace(/\s{2,}/g, ' ').trim();
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEntry(value: unknown): value is MemorialNameEntry {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.name === 'string' && row.name.trim().length > 0;
}

function isSnapshot(value: unknown): value is MemorialCatalogSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const snap = value as Record<string, unknown>;
  return typeof snap.version === 'string' && Array.isArray(snap.names);
}

function normalizeEntry(raw: MemorialNameEntry): MemorialNameEntry {
  return {
    name: plainDashCopy(raw.name),
    ...(typeof raw.entityId === 'string' && raw.entityId.trim()
      ? { entityId: raw.entityId.trim() }
      : {}),
    ...(typeof raw.locationLabel === 'string' && raw.locationLabel.trim()
      ? { locationLabel: plainDashCopy(raw.locationLabel) }
      : {}),
    ...(typeof raw.placeLabel === 'string' && raw.placeLabel.trim()
      ? { placeLabel: plainDashCopy(raw.placeLabel) }
      : {}),
    ...(isFiniteCoord(raw.lat) && isFiniteCoord(raw.lng)
      ? { lat: raw.lat, lng: raw.lng }
      : {}),
    ...(typeof raw.locationPrecision === 'string' && raw.locationPrecision.trim()
      ? { locationPrecision: raw.locationPrecision }
      : {}),
  };
}

export function loadMemorialCatalog(): MemorialCatalogSnapshot {
  if (!isSnapshot(catalogSeed)) {
    return {
      version: 'unavailable',
      generatedAt: new Date(0).toISOString(),
      incompleteByDesign: true,
      names: [],
    };
  }
  const names = (catalogSeed.names as readonly unknown[])
    .filter(isEntry)
    .map(normalizeEntry)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return {
    version: catalogSeed.version,
    generatedAt: catalogSeed.generatedAt,
    incompleteByDesign: catalogSeed.incompleteByDesign !== false,
    names,
  };
}

export function listMemorialNames(): readonly MemorialNameEntry[] {
  return loadMemorialCatalog().names;
}

/**
 * Case-insensitive filter over name and place labels.
 * Empty query returns the full alphabetical list.
 */
export function filterMemorialNames(
  names: readonly MemorialNameEntry[],
  query: string,
): readonly MemorialNameEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return names;
  return names.filter((row) => {
    const haystack = [row.name, row.placeLabel ?? '', row.locationLabel ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function memorialPulse(snapshot: MemorialCatalogSnapshot = loadMemorialCatalog()): {
  readonly nameCount: number;
  readonly linkedCount: number;
  readonly mappedCount: number;
  readonly version: string;
} {
  let linkedCount = 0;
  let mappedCount = 0;
  for (const row of snapshot.names) {
    if (row.entityId) linkedCount += 1;
    if (isFiniteCoord(row.lat) && isFiniteCoord(row.lng)) mappedCount += 1;
  }
  return {
    nameCount: snapshot.names.length,
    linkedCount,
    mappedCount,
    version: snapshot.version,
  };
}
