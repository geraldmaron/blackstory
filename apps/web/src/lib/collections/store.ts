/**
 * Saved records, backed by `localStorage`.
 *
 * Schema-versioned from the first release. A saved list is reader-authored data — the one thing on
 * this surface the archive did not supply — so it has to survive a shape change rather than being
 * silently dropped the first time a field is added.
 *
 * Every read is defensive. `localStorage` can hold anything: a half-written value from a closed
 * tab, a payload from a much older build, or a string some other tool wrote to the same key. A
 * throw here would take the whole surface down on mount, so a corrupt payload reads as an empty
 * list and is replaced on the next write.
 */

export const COLLECTIONS_STORAGE_KEY = 'blackstory.saved.v1';
export const COLLECTIONS_SCHEMA_VERSION = 1;

export type SavedRecord = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly place: string;
  readonly era: string;
  /** Reader-facing evidence letter, or null when the record is ungraded. */
  readonly grade: string | null;
  readonly href: string;
  readonly lng?: number;
  readonly lat?: number;
  /** ISO timestamp. Injected by the caller so saves are deterministic in tests. */
  readonly savedAt: string;
};

export type SavedCollection = {
  readonly version: number;
  readonly records: readonly SavedRecord[];
};

export const EMPTY_COLLECTION: SavedCollection = {
  version: COLLECTIONS_SCHEMA_VERSION,
  records: [],
};

/** The subset of the Storage API this module uses, so tests can supply a plain object. */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function isSavedRecord(value: unknown): value is SavedRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.name === 'string' &&
    typeof record.href === 'string'
  );
}

/** Fills in the fields an older payload may not carry, so one missing key is not a dropped record. */
function normalize(value: SavedRecord): SavedRecord {
  return {
    id: value.id,
    name: value.name,
    kind: typeof value.kind === 'string' ? value.kind : 'other',
    place: typeof value.place === 'string' ? value.place : '',
    era: typeof value.era === 'string' ? value.era : '',
    grade: typeof value.grade === 'string' ? value.grade : null,
    href: value.href,
    ...(typeof value.lng === 'number' && Number.isFinite(value.lng) ? { lng: value.lng } : {}),
    ...(typeof value.lat === 'number' && Number.isFinite(value.lat) ? { lat: value.lat } : {}),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
  };
}

export function readCollection(storage: StorageLike | null | undefined): SavedCollection {
  if (!storage) return EMPTY_COLLECTION;

  let raw: string | null;
  try {
    raw = storage.getItem(COLLECTIONS_STORAGE_KEY);
  } catch {
    // Storage can throw outright: Safari private browsing, a disabled-cookies profile, a
    // cross-origin frame. A reader with storage switched off still gets a working surface.
    return EMPTY_COLLECTION;
  }
  if (raw === null) return EMPTY_COLLECTION;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_COLLECTION;
  }

  if (typeof parsed !== 'object' || parsed === null) return EMPTY_COLLECTION;
  const payload = parsed as { version?: unknown; records?: unknown };

  // A payload from a future version is left alone rather than half-read. Reading it with today's
  // rules and writing it back would destroy whatever the newer build stored.
  if (typeof payload.version !== 'number' || payload.version > COLLECTIONS_SCHEMA_VERSION) {
    return EMPTY_COLLECTION;
  }
  if (!Array.isArray(payload.records)) return EMPTY_COLLECTION;

  return {
    version: COLLECTIONS_SCHEMA_VERSION,
    records: payload.records.filter(isSavedRecord).map(normalize),
  };
}

export function writeCollection(
  storage: StorageLike | null | undefined,
  collection: SavedCollection,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      COLLECTIONS_STORAGE_KEY,
      JSON.stringify({ version: COLLECTIONS_SCHEMA_VERSION, records: collection.records }),
    );
  } catch {
    // Quota exceeded or storage disabled. The in-memory list still works for this session; losing
    // the write is better than losing the surface.
  }
}

/** Adds a record, or moves it to the front if it is already saved. Never duplicates an id. */
export function saveRecord(collection: SavedCollection, record: SavedRecord): SavedCollection {
  return {
    version: COLLECTIONS_SCHEMA_VERSION,
    records: [record, ...collection.records.filter((entry) => entry.id !== record.id)],
  };
}

export function unsaveRecord(collection: SavedCollection, id: string): SavedCollection {
  return {
    version: COLLECTIONS_SCHEMA_VERSION,
    records: collection.records.filter((entry) => entry.id !== id),
  };
}

export function isSaved(collection: SavedCollection, id: string): boolean {
  return collection.records.some((entry) => entry.id === id);
}

export function savedIds(collection: SavedCollection): ReadonlySet<string> {
  return new Set(collection.records.map((entry) => entry.id));
}

export function clearCollection(): SavedCollection {
  return EMPTY_COLLECTION;
}

/**
 * The saved list as GeoJSON.
 *
 * Records with no published coordinates are omitted from the features rather than placed at
 * `[0, 0]`. A point in the Gulf of Guinea is a worse answer than no point.
 */
export function toGeoJson(collection: SavedCollection): {
  readonly type: 'FeatureCollection';
  readonly features: readonly unknown[];
} {
  return {
    type: 'FeatureCollection',
    features: collection.records
      .filter((record) => typeof record.lng === 'number' && typeof record.lat === 'number')
      .map((record) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [record.lng, record.lat] },
        properties: {
          id: record.id,
          name: record.name,
          kind: record.kind,
          place: record.place,
          era: record.era,
          grade: record.grade,
          href: record.href,
        },
      })),
  };
}

/** How many saved records `toGeoJson` had to leave out, so the reader can be told. */
export function unmappableCount(collection: SavedCollection): number {
  return collection.records.filter(
    (record) => typeof record.lng !== 'number' || typeof record.lat !== 'number',
  ).length;
}
