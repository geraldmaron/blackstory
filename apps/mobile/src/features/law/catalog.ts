/**
 * Law catalog loader and browse helpers for native mobile.
 * Reads the on-device seed exported from the web legal catalog.
 */
import catalogSeed from './catalog-seed.json';
import {
  LAW_JURISDICTION_LABELS,
  LAW_KIND_LABELS,
  LAW_STATUS_LABELS,
  LAW_TOPIC_LABELS,
} from './law-copy';
import type {
  LawCatalogEntry,
  LawCatalogRow,
  LawCatalogSnapshot,
  LawSnapshotKind,
  LawStatus,
  LawTopic,
} from './types';

/** Replace em/en dashes in display strings (brand: no em dashes in UI copy). */
export function plainDashCopy(value: string): string {
  return value.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' to ').replace(/\s{2,}/g, ' ').trim();
}

function isKind(value: unknown): value is LawSnapshotKind {
  return (
    value === 'federal-statute' ||
    value === 'federal-regulation' ||
    value === 'constitutional-amendment' ||
    value === 'landmark-case' ||
    value === 'state-statute'
  );
}

function isStatus(value: unknown): value is LawStatus {
  return (
    value === 'in_force' ||
    value === 'amended' ||
    value === 'repealed' ||
    value === 'struck_down' ||
    value === 'enjoined'
  );
}

function isTopic(value: unknown): value is LawTopic {
  return (
    value === 'voting' ||
    value === 'housing' ||
    value === 'employment' ||
    value === 'education' ||
    value === 'policing' ||
    value === 'constitutional' ||
    value === 'criminal-justice'
  );
}

function isEntry(value: unknown): value is LawCatalogEntry {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.title === 'string' &&
    isKind(row.kind) &&
    isStatus(row.lawStatus) &&
    typeof row.citation === 'string' &&
    Array.isArray(row.topics)
  );
}

function isSnapshot(value: unknown): value is LawCatalogSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const snap = value as Record<string, unknown>;
  return typeof snap.version === 'string' && Array.isArray(snap.entries);
}

export function kindLabel(kind: LawSnapshotKind): string {
  return LAW_KIND_LABELS[kind] ?? kind;
}

export function statusLabel(status: LawStatus): string {
  return LAW_STATUS_LABELS[status] ?? status;
}

export function topicLabel(topic: LawTopic): string {
  return LAW_TOPIC_LABELS[topic] ?? topic;
}

export function jurisdictionLabel(jurisdictionId: string): string {
  return LAW_JURISDICTION_LABELS[jurisdictionId] ?? jurisdictionId.toUpperCase();
}

export function toCatalogRow(entry: LawCatalogEntry): LawCatalogRow {
  return {
    id: entry.id,
    slug: entry.slug,
    title: plainDashCopy(entry.title),
    kind: entry.kind,
    kindLabel: kindLabel(entry.kind),
    lawStatus: entry.lawStatus,
    statusLabel: statusLabel(entry.lawStatus),
    citation: plainDashCopy(entry.citation),
    topicsLabel: entry.topics.map(topicLabel).join(' · '),
    hasExplainer: entry.explainer !== undefined,
  };
}

/** Loads the embedded catalog snapshot; returns empty entries if seed is malformed. */
export function loadLawCatalog(): LawCatalogSnapshot {
  if (!isSnapshot(catalogSeed)) {
    return { version: 'unavailable', generatedAt: new Date(0).toISOString(), entries: [] };
  }
  const entries: LawCatalogEntry[] = [];
  for (const raw of catalogSeed.entries as readonly unknown[]) {
    if (!isEntry(raw)) continue;
    const { canonicalEntityId, explainer, factId, ...rest } = raw;
    const entry: LawCatalogEntry = {
      ...rest,
      topics: raw.topics.filter(isTopic),
      ...(factId ? { factId } : {}),
      ...(canonicalEntityId ? { canonicalEntityId } : {}),
      ...(explainer ? { explainer } : {}),
    };
    entries.push(entry);
  }
  return {
    version: catalogSeed.version,
    generatedAt: catalogSeed.generatedAt,
    entries,
  };
}

export function getLawBySlug(slug: string): LawCatalogEntry | undefined {
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return loadLawCatalog().entries.find((entry) => entry.slug.toLowerCase() === normalized);
}

export function listCatalogRows(): readonly LawCatalogRow[] {
  return loadLawCatalog().entries.map(toCatalogRow);
}

/**
 * Case-insensitive filter over title, citation, kind, status, and topics.
 * Empty query returns the full catalog (title-sorted).
 */
export function filterCatalogRows(
  rows: readonly LawCatalogRow[],
  query: string,
  kindFilter: string = 'all',
): readonly LawCatalogRow[] {
  const q = query.trim().toLowerCase();
  const kind = kindFilter.trim().toLowerCase();
  const sorted = [...rows].sort((a, b) => a.title.localeCompare(b.title));
  return sorted.filter((row) => {
    if (kind !== 'all' && kind.length > 0 && row.kind !== kind) return false;
    if (q.length === 0) return true;
    const haystack = [row.title, row.citation, row.kindLabel, row.statusLabel, row.topicsLabel]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function catalogPulse(snapshot: LawCatalogSnapshot = loadLawCatalog()): {
  readonly entryCount: number;
  readonly explainerCount: number;
  readonly kindCount: number;
  readonly version: string;
} {
  const kinds = new Set<string>();
  let explainerCount = 0;
  for (const entry of snapshot.entries) {
    kinds.add(entry.kind);
    if (entry.explainer) explainerCount += 1;
  }
  return {
    entryCount: snapshot.entries.length,
    explainerCount,
    kindCount: kinds.size,
    version: snapshot.version,
  };
}

export function listKindFilters(rows: readonly LawCatalogRow[] = listCatalogRows()): readonly {
  readonly value: string;
  readonly label: string;
}[] {
  const kinds = [...new Set(rows.map((row) => row.kind))].sort();
  return [
    { value: 'all', label: 'All kinds' },
    ...kinds.map((kind) => ({ value: kind, label: kindLabel(kind as LawSnapshotKind) })),
  ];
}

/** Defensive slug parse for route params (kebab-case, bounded). */
export function parseLawSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 160) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return null;
  return trimmed;
}
