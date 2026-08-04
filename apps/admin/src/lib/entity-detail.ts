/**
 * Server-side read of one canonical entity, for the editable detail page.
 *
 * Identifiers and locations live in their own tables (`entity_identifiers`, 919 rows;
 * `entity_locations`, 4,108 rows), not in the JSONB columns of the same name on `entities` —
 * only 23 rows carry JSONB identifiers at all, and `entity_aliases` is empty while 19 rows carry
 * JSONB aliases. That split is verified against the live database, not inferred: reading the
 * wrong side of it is exactly the class of drift repo-gyq6.13 records. Aliases are read from
 * JSONB; identifiers and locations from their tables.
 */
import { queryPostgres } from './postgres-client.js';
import type { EntitySensitivity } from './entity-query.js';
import type { LivingStatus } from './entity-vocabulary.js';

export type EntityIdentifierRow = {
  readonly id: string;
  readonly namespace: string;
  readonly value: string;
  readonly trusted: boolean;
};

export type EntityLocationRow = {
  readonly id: string;
  readonly role: string;
  readonly label?: string;
  readonly precision?: string;
  readonly lat?: number;
  readonly lng?: number;
};

export type EntityDetail = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly entityClass?: string;
  readonly livingStatus: LivingStatus | string;
  readonly aliases: readonly string[];
  readonly sensitivity: readonly EntitySensitivity[];
  readonly identifiers: readonly EntityIdentifierRow[];
  readonly locations: readonly EntityLocationRow[];
  readonly claimCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mergedIntoId?: string;
};

type DetailRow = {
  readonly id: string;
  readonly kind: string;
  readonly entity_class: string | null;
  readonly display_name: string;
  readonly living_status: string;
  readonly aliases: unknown;
  readonly sensitivity: unknown;
  readonly merge_state: unknown;
  readonly claim_count: string | number;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Aliases are JSONB strings; object entries are tolerated for older rows. */
export function parseAliasList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry);
    } else if (entry && typeof entry === 'object') {
      const candidate = (entry as { value?: unknown }).value;
      if (typeof candidate === 'string' && candidate.trim().length > 0) out.push(candidate);
    }
  }
  return out;
}

export function parseSensitivityList(value: unknown): readonly EntitySensitivity[] {
  if (!Array.isArray(value)) return [];
  const out: EntitySensitivity[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { class?: unknown; source?: unknown };
    if (typeof record.class !== 'string' || record.class.length === 0) continue;
    out.push({
      class: record.class,
      ...(typeof record.source === 'string' ? { source: record.source } : {}),
    });
  }
  return out;
}

function readSurvivorId(mergeState: unknown): string | undefined {
  if (!mergeState || typeof mergeState !== 'object') return undefined;
  const record = mergeState as { status?: unknown; survivorId?: unknown };
  if (record.status !== 'absorbed') return undefined;
  return typeof record.survivorId === 'string' ? record.survivorId : undefined;
}

export async function readEntityDetail(entityId: string): Promise<EntityDetail | null> {
  const id = entityId.trim();
  if (!id) return null;

  const rows = await queryPostgres<DetailRow>(
    `SELECT
       e.id, e.kind, e.entity_class, e.display_name, e.living_status,
       e.aliases, e.sensitivity, e.merge_state, e.created_at, e.updated_at,
       (SELECT count(*) FROM bb_canonical.claims c WHERE c.entity_id = e.id) AS claim_count
     FROM bb_canonical.entities e
     WHERE e.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;

  const [identifiers, locations] = await Promise.all([
    queryPostgres<{
      readonly id: string;
      readonly namespace: string;
      readonly value: string;
      readonly trusted: boolean;
    }>(
      `SELECT id, namespace, value, trusted
       FROM bb_canonical.entity_identifiers
       WHERE entity_id = $1
       ORDER BY namespace ASC, value ASC`,
      [id],
    ),
    queryPostgres<{
      readonly id: string;
      readonly role: string;
      readonly label: string | null;
      readonly precision: string | null;
      readonly lat: number | null;
      readonly lng: number | null;
    }>(
      `SELECT id, role, label, precision, lat, lng
       FROM bb_canonical.entity_locations
       WHERE entity_id = $1
       ORDER BY role ASC, id ASC`,
      [id],
    ),
  ]);

  const entityClass = row.entity_class ?? undefined;
  const mergedIntoId = readSurvivorId(row.merge_state);

  return {
    id: row.id,
    displayName: row.display_name,
    kind: row.kind,
    ...(entityClass ? { entityClass } : {}),
    livingStatus: row.living_status,
    aliases: parseAliasList(row.aliases),
    sensitivity: parseSensitivityList(row.sensitivity),
    identifiers: identifiers.map((identifier) => ({
      id: identifier.id,
      namespace: identifier.namespace,
      value: identifier.value,
      trusted: identifier.trusted,
    })),
    locations: locations.map((location) => ({
      id: location.id,
      role: location.role,
      ...(location.label ? { label: location.label } : {}),
      ...(location.precision ? { precision: location.precision } : {}),
      ...(location.lat !== null ? { lat: location.lat } : {}),
      ...(location.lng !== null ? { lng: location.lng } : {}),
    })),
    claimCount: Number(row.claim_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(mergedIntoId ? { mergedIntoId } : {}),
  };
}
