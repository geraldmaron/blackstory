/**
 * Firestore Admin reads for canonical entity catalog browsing in the management portal.
 * Lists and detail views are read-only; mutations stay in domain commit paths.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type CatalogEntityListItem = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly updatedAt: string;
  readonly livingStatus?: 'living' | 'deceased' | 'unknown';
  readonly sensitivity?: readonly string[];
};

export type CatalogEntityLocation = {
  readonly id: string;
  readonly label?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly precision?: string;
};

export type CatalogEntityDetail = CatalogEntityListItem & {
  readonly aliases: readonly { readonly value: string; readonly kind?: string }[];
  readonly identifiers: readonly {
    readonly system: string;
    readonly value: string;
    readonly note?: string;
  }[];
  readonly locations: readonly CatalogEntityLocation[];
  readonly claimCount?: number;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readLivingStatus(value: unknown): 'living' | 'deceased' | 'unknown' | undefined {
  if (value === 'living' || value === 'deceased' || value === 'unknown') {
    return value;
  }
  return undefined;
}

function readSensitivity(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === 'string');
  return items.length > 0 ? items : undefined;
}

function parseLocation(docId: string, data: Record<string, unknown>): CatalogEntityLocation {
  const label = readString(data.label);
  const precision = readString(data.precision);
  let lat: number | undefined;
  let lng: number | undefined;

  const point = data.point;
  if (point && typeof point === 'object') {
    const pointRecord = point as { lat?: unknown; lng?: unknown };
    if (typeof pointRecord.lat === 'number' && typeof pointRecord.lng === 'number') {
      lat = pointRecord.lat;
      lng = pointRecord.lng;
    }
  }

  if (lat === undefined || lng === undefined) {
    const geometry = data.geometry;
    if (geometry && typeof geometry === 'object') {
      const geometryRecord = geometry as { type?: unknown; coordinates?: unknown };
      if (geometryRecord.type === 'Point' && Array.isArray(geometryRecord.coordinates)) {
        const coords = geometryRecord.coordinates;
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          lng = coords[0];
          lat = coords[1];
        }
      }
    }
  }

  return {
    id: docId,
    ...(label ? { label } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(precision ? { precision } : {}),
  };
}

function toListItem(docId: string, data: Record<string, unknown>): CatalogEntityListItem | null {
  const displayName = readString(data.displayName);
  const kind = readString(data.kind);
  const updatedAt = readString(data.updatedAt);
  if (!displayName || !kind || !updatedAt) return null;

  const livingStatus = readLivingStatus(data.livingStatus);
  const sensitivity = readSensitivity(data.sensitivity);

  return {
    id: docId,
    displayName,
    kind,
    updatedAt,
    ...(livingStatus ? { livingStatus } : {}),
    ...(sensitivity ? { sensitivity } : {}),
  };
}

function matchesSearch(item: CatalogEntityListItem, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.displayName.toLowerCase().includes(needle) ||
    item.id.toLowerCase().includes(needle) ||
    item.kind.toLowerCase().includes(needle)
  );
}

export async function listCanonicalEntities(
  limit = 100,
  search?: string,
): Promise<readonly CatalogEntityListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const searchTerm = search?.trim() ?? '';
  const fetchLimit = searchTerm ? Math.min(500, cappedLimit * 5) : cappedLimit;

  const snap = await db
    .collection(FIRESTORE_ROOT.canonicalEntities)
    .orderBy('updatedAt', 'desc')
    .limit(fetchLimit)
    .get();

  const items: CatalogEntityListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (!parsed) continue;
    if (searchTerm && !matchesSearch(parsed, searchTerm)) continue;
    items.push(parsed);
    if (items.length >= cappedLimit) break;
  }

  return items;
}

async function countClaimsForEntity(entityId: string): Promise<number | undefined> {
  const db = getDb();
  try {
    const agg = await db
      .collection(FIRESTORE_ROOT.canonicalClaims)
      .where('entityId', '==', entityId)
      .count()
      .get();
    return agg.data().count;
  } catch (error) {
    console.error('admin catalog claim count failed', entityId, error);
    return undefined;
  }
}

export async function getCanonicalEntityDetail(id: string): Promise<CatalogEntityDetail | null> {
  const db = getDb();
  const entityRef = db.collection(FIRESTORE_ROOT.canonicalEntities).doc(id);
  const [entitySnap, locationsSnap, claimCount] = await Promise.all([
    entityRef.get(),
    entityRef.collection('locations').limit(20).get(),
    countClaimsForEntity(id),
  ]);

  if (!entitySnap.exists) return null;
  const data = entitySnap.data() as Record<string, unknown>;
  const base = toListItem(entitySnap.id, data);
  if (!base) return null;

  const aliasesRaw = Array.isArray(data.aliases) ? data.aliases : [];
  const aliases = aliasesRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { value?: unknown; kind?: unknown };
      const value = readString(record.value);
      if (!value) return null;
      const kind = readString(record.kind);
      return { value, ...(kind ? { kind } : {}) };
    })
    .filter((entry): entry is { value: string; kind?: string } => entry !== null);

  const identifiersRaw = Array.isArray(data.identifiers) ? data.identifiers : [];
  const identifiers = identifiersRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { system?: unknown; value?: unknown; note?: unknown };
      const system = readString(record.system);
      const value = readString(record.value);
      if (!system || !value) return null;
      const note = readString(record.note);
      return { system, value, ...(note ? { note } : {}) };
    })
    .filter((entry): entry is { system: string; value: string; note?: string } => entry !== null);

  const locations = locationsSnap.docs.map((doc) =>
    parseLocation(doc.id, doc.data() as Record<string, unknown>),
  );

  return {
    ...base,
    aliases,
    identifiers,
    locations,
    ...(claimCount !== undefined ? { claimCount } : {}),
  };
}

export async function tryListCanonicalEntities(
  limit?: number,
  search?: string,
): Promise<readonly CatalogEntityListItem[] | null> {
  try {
    return await listCanonicalEntities(limit, search);
  } catch (error) {
    console.error('admin canonicalEntities list failed', error);
    return null;
  }
}

export async function tryGetCanonicalEntityDetail(id: string): Promise<CatalogEntityDetail | null> {
  try {
    return await getCanonicalEntityDetail(id);
  } catch (error) {
    console.error('admin canonicalEntity detail failed', id, error);
    return null;
  }
}
