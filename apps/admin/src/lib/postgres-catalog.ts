/**
 * Postgres reads for bb_canonical entities/locations and bb_ops catalog decisions.
 */
import type pg from 'pg';
import { queryPostgres } from './postgres-client.js';

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

export type CatalogDecisionAction = 'flag_for_retraction' | 'needs_review' | 'clear_flag';

export type CatalogDecisionRecord = {
  readonly entityId: string;
  readonly action: CatalogDecisionAction;
  readonly reason: string;
  readonly decidedByUid: string;
  readonly decidedByEmail: string;
  readonly decidedAt: string;
};

type EntityRow = {
  readonly id: string;
  readonly kind: string;
  readonly display_name: string;
  readonly living_status: string;
  readonly sensitivity: unknown;
  readonly aliases: unknown;
  readonly identifiers: unknown;
  readonly updated_at: Date | string;
};

type LocationRow = {
  readonly id: string;
  readonly label: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly precision: string | null;
  readonly geometry: unknown;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readLivingStatus(value: unknown): 'living' | 'deceased' | 'unknown' | undefined {
  if (value === 'living' || value === 'deceased' || value === 'unknown') return value;
  return undefined;
}

function readSensitivity(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === 'string');
  return items.length > 0 ? items : undefined;
}

function toListItem(row: EntityRow): CatalogEntityListItem {
  const livingStatus = readLivingStatus(row.living_status);
  const sensitivity = readSensitivity(row.sensitivity);
  return {
    id: row.id,
    displayName: row.display_name,
    kind: row.kind,
    updatedAt: toIso(row.updated_at),
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

function parseLocation(row: LocationRow): CatalogEntityLocation {
  let lat = row.lat ?? undefined;
  let lng = row.lng ?? undefined;
  if ((lat === undefined || lng === undefined) && row.geometry && typeof row.geometry === 'object') {
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown };
    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
      const coords = geometry.coordinates;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        lng = coords[0];
        lat = coords[1];
      }
    }
  }
  const label = readString(row.label);
  const precision = readString(row.precision);
  return {
    id: row.id,
    ...(label ? { label } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(precision ? { precision } : {}),
  };
}

let claimsTableExists: boolean | undefined;

async function tableExists(schema: string, table: string): Promise<boolean> {
  const rows = await queryPostgres<{ readonly exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2
     ) AS exists`,
    [schema, table],
  );
  return rows[0]?.exists === true;
}

async function countClaimsForEntity(entityId: string): Promise<number | undefined> {
  try {
    if (claimsTableExists === undefined) {
      claimsTableExists = await tableExists('bb_canonical', 'claims');
    }
    if (!claimsTableExists) return undefined;
    const rows = await queryPostgres<{ readonly count: string }>(
      `SELECT count(*)::text AS count FROM bb_canonical.claims WHERE entity_id = $1`,
      [entityId],
    );
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    console.error('admin catalog claim count failed', entityId, error);
    return undefined;
  }
}

export async function listCanonicalEntitiesPostgres(
  limit: number,
  search?: string,
): Promise<readonly CatalogEntityListItem[]> {
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const searchTerm = search?.trim() ?? '';
  const fetchLimit = searchTerm ? Math.min(500, cappedLimit * 5) : cappedLimit;

  const rows = await queryPostgres<EntityRow>(
    `SELECT id, kind, display_name, living_status, sensitivity, aliases, identifiers, updated_at
     FROM bb_canonical.entities
     ORDER BY updated_at DESC
     LIMIT $1`,
    [fetchLimit],
  );

  const items: CatalogEntityListItem[] = [];
  for (const row of rows) {
    const parsed = toListItem(row);
    if (searchTerm && !matchesSearch(parsed, searchTerm)) continue;
    items.push(parsed);
    if (items.length >= cappedLimit) break;
  }
  return items;
}

export async function getCanonicalEntityDetailPostgres(
  id: string,
): Promise<CatalogEntityDetail | null> {
  const entities = await queryPostgres<EntityRow>(
    `SELECT id, kind, display_name, living_status, sensitivity, aliases, identifiers, updated_at
     FROM bb_canonical.entities
     WHERE id = $1`,
    [id],
  );
  if (entities.length === 0) return null;
  const entity = entities[0]!;

  const [locations, claimCount] = await Promise.all([
    queryPostgres<LocationRow>(
      `SELECT id, label, lat, lng, precision, geometry
       FROM bb_canonical.entity_locations
       WHERE entity_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [id],
    ),
    countClaimsForEntity(id),
  ]);

  const base = toListItem(entity);
  const aliasesRaw = Array.isArray(entity.aliases) ? entity.aliases : [];
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

  const identifiersRaw = Array.isArray(entity.identifiers) ? entity.identifiers : [];
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

  return {
    ...base,
    aliases,
    identifiers,
    locations: locations.map(parseLocation),
    ...(claimCount !== undefined ? { claimCount } : {}),
  };
}

type CatalogDecisionRow = {
  readonly entity_id: string;
  readonly decision: CatalogDecisionAction;
  readonly actor_id: string;
  readonly reason: string | null;
  readonly decided_at: Date | string;
  readonly metadata: Record<string, unknown> | null;
};

function mapCatalogDecisionRow(row: CatalogDecisionRow): CatalogDecisionRecord {
  const decidedByEmail =
    readString(row.metadata?.decidedByEmail) ??
    readString(row.metadata?.decided_by_email) ??
    row.actor_id;
  return {
    entityId: row.entity_id,
    action: row.decision,
    reason: row.reason ?? '',
    decidedByUid: row.actor_id,
    decidedByEmail,
    decidedAt: toIso(row.decided_at),
  };
}

export async function listCatalogDecisionsPostgres(
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, CatalogDecisionRecord>> {
  if (entityIds.length === 0) return new Map();
  const rows = await queryPostgres<CatalogDecisionRow>(
    `SELECT entity_id, decision, actor_id, reason, decided_at, metadata
     FROM bb_ops.catalog_decisions
     WHERE entity_id = ANY($1::text[])`,
    [entityIds],
  );
  const results = new Map<string, CatalogDecisionRecord>();
  for (const row of rows) {
    results.set(row.entity_id, mapCatalogDecisionRow(row));
  }
  return results;
}

export async function writeCatalogDecisionPostgres(
  client: pg.PoolClient,
  input: {
    readonly record: CatalogDecisionRecord;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO bb_ops.catalog_decisions
      (entity_id, decision, actor_id, reason, decided_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (entity_id) DO UPDATE SET
       decision = EXCLUDED.decision,
       actor_id = EXCLUDED.actor_id,
       reason = EXCLUDED.reason,
       decided_at = EXCLUDED.decided_at,
       metadata = EXCLUDED.metadata`,
    [
      input.record.entityId,
      input.record.action,
      input.record.decidedByUid,
      input.record.reason,
      input.record.decidedAt,
      JSON.stringify({ decidedByEmail: input.record.decidedByEmail }),
    ],
  );
}
