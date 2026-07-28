/**
 * Themes catalog loader and browse helpers for native mobile.
 * Reads the on-device seed exported from domain researched packets + web catalog.
 */
import catalogSeed from './catalog-seed.json';
import type {
  ThemeCatalogEntry,
  ThemeImpactPriority,
  ThemePacketView,
  ThemesCatalogRow,
  ThemesCatalogSnapshot,
} from './types';

/** Replace em/en dashes in display strings (brand: no em dashes in UI copy). */
export function plainDashCopy(value: string): string {
  return value.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' to ').replace(/\s{2,}/g, ' ').trim();
}

function isPriority(value: unknown): value is ThemeImpactPriority {
  return value === 'P0' || value === 'P1';
}

function isThemeEntry(value: unknown): value is ThemeCatalogEntry {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    isPriority(row.priority) &&
    typeof row.lede === 'string' &&
    typeof row.available === 'boolean'
  );
}

function isPacketView(value: unknown): value is ThemePacketView {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.questionId === 'string' &&
    typeof row.themeId === 'string' &&
    typeof row.question === 'string' &&
    typeof row.methodNote === 'string' &&
    typeof row.observationsSummary === 'string' &&
    Array.isArray(row.observations) &&
    Array.isArray(row.artifacts)
  );
}

function isSnapshot(value: unknown): value is ThemesCatalogSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const snap = value as Record<string, unknown>;
  return (
    typeof snap.version === 'string' &&
    Array.isArray(snap.themes) &&
    Array.isArray(snap.packets)
  );
}

/** Loads the embedded themes snapshot; returns empty if seed is malformed. */
export function loadThemesCatalog(): ThemesCatalogSnapshot {
  if (!isSnapshot(catalogSeed)) {
    return {
      version: 'unavailable',
      generatedAt: new Date(0).toISOString(),
      source: 'unavailable',
      releaseId: 'unavailable',
      releaseLabel: 'Unavailable',
      themes: [],
      packets: [],
    };
  }
  const themes = (catalogSeed.themes as readonly unknown[])
    .filter(isThemeEntry)
    .map((entry) => ({
      ...entry,
      title: plainDashCopy(entry.title),
      lede: plainDashCopy(entry.lede),
    }));
  const packets = (catalogSeed.packets as readonly unknown[])
    .filter(isPacketView)
    .map((packet) => ({
      ...packet,
      question: plainDashCopy(packet.question),
      methodNote: plainDashCopy(packet.methodNote),
      observationsSummary: plainDashCopy(packet.observationsSummary),
    }));
  return {
    version: catalogSeed.version,
    generatedAt: catalogSeed.generatedAt,
    source: typeof catalogSeed.source === 'string' ? catalogSeed.source : 'curated-seed',
    releaseId:
      typeof catalogSeed.releaseId === 'string' ? catalogSeed.releaseId : 'unknown',
    releaseLabel:
      typeof catalogSeed.releaseLabel === 'string'
        ? catalogSeed.releaseLabel
        : 'Curated on-device fixture',
    themes,
    packets,
  };
}

export function listPacketsForTheme(themeId: string): readonly ThemePacketView[] {
  const normalized = themeId.trim().toLowerCase();
  return loadThemesCatalog().packets.filter(
    (packet) => packet.themeId.toLowerCase() === normalized,
  );
}

export function getThemeById(themeId: string): ThemeCatalogEntry | undefined {
  const normalized = themeId.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return loadThemesCatalog().themes.find((entry) => entry.id.toLowerCase() === normalized);
}

export function toCatalogRow(entry: ThemeCatalogEntry): ThemesCatalogRow {
  const packetCount = listPacketsForTheme(entry.id).length;
  return {
    id: entry.id,
    title: entry.title,
    priority: entry.priority,
    priorityLabel: entry.priority === 'P0' ? 'Priority P0' : 'Priority P1',
    lede: entry.lede,
    available: entry.available,
    packetCount,
    statusLabel: entry.available
      ? packetCount > 0
        ? `${packetCount} packet${packetCount === 1 ? '' : 's'}`
        : 'Available'
      : 'Coming soon',
  };
}

export function listCatalogRows(): readonly ThemesCatalogRow[] {
  return loadThemesCatalog().themes.map(toCatalogRow);
}

export function listP0Rows(rows: readonly ThemesCatalogRow[] = listCatalogRows()): readonly ThemesCatalogRow[] {
  return rows.filter((row) => row.priority === 'P0');
}

export function listP1Rows(rows: readonly ThemesCatalogRow[] = listCatalogRows()): readonly ThemesCatalogRow[] {
  return rows.filter((row) => row.priority === 'P1');
}

/**
 * Case-insensitive filter over title, lede, and priority label.
 * Empty query returns the full catalog (priority then title).
 */
export function filterCatalogRows(
  rows: readonly ThemesCatalogRow[],
  query: string,
): readonly ThemesCatalogRow[] {
  const q = query.trim().toLowerCase();
  const sorted = [...rows].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    return a.title.localeCompare(b.title);
  });
  if (q.length === 0) return sorted;
  return sorted.filter((row) => {
    const haystack = [row.title, row.lede, row.priorityLabel, row.statusLabel, row.id]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function catalogPulse(snapshot: ThemesCatalogSnapshot = loadThemesCatalog()): {
  readonly themeCount: number;
  readonly p0Count: number;
  readonly packetCount: number;
  readonly version: string;
  readonly releaseLabel: string;
  readonly source: string;
  readonly generatedAt: string;
} {
  return {
    themeCount: snapshot.themes.length,
    p0Count: snapshot.themes.filter((t) => t.priority === 'P0').length,
    packetCount: snapshot.packets.length,
    version: snapshot.version,
    releaseLabel: snapshot.releaseLabel,
    source: snapshot.source,
    generatedAt: snapshot.generatedAt,
  };
}

/**
 * Defensive theme id parse for route params (snake_case, bounded).
 * Accepts Expo Router string | string[] params.
 */
export function parseThemeId(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 80) return null;
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(trimmed)) return null;
  return trimmed;
}
