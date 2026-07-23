import type { PgWriter } from './pg-writer.js';
import { stableJson } from './canonical-convergence.js';

type JsonRecord = Record<string, unknown>;

export type CanonicalReleaseGateRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly claims: unknown;
  readonly taxonomy: unknown;
  readonly primary_image?: unknown;
};

type CanonicalEntityRow = {
  readonly id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly kind_detail: JsonRecord;
};

type CanonicalLocationRow = {
  readonly entity_id: string;
  readonly lat: number;
  readonly lng: number;
};

type CanonicalClaimRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly predicate: string;
  readonly object: unknown;
  readonly body: JsonRecord;
  readonly confidence: JsonRecord | null;
};

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function claimRows(row: CanonicalReleaseGateRow): JsonRecord[] {
  if (!Array.isArray(row.claims)) {
    throw new Error(
      `${row.entity_id}: public claims must be an array generated from canonical claims`,
    );
  }
  if (row.claims.length === 0) {
    throw new Error(`${row.entity_id}: public release cannot be generated with zero claims`);
  }
  return row.claims.map((claim, index) => {
    const parsed = asRecord(claim);
    requiredString(parsed.id, `${row.entity_id}.claims[${index}].id`);
    requiredString(parsed.predicate, `${row.entity_id}.claims[${index}].predicate`);
    requiredString(parsed.object, `${row.entity_id}.claims[${index}].object`);
    return parsed;
  });
}

function samePoint(left: number | undefined, right: number): boolean {
  return typeof left === 'number' && Math.abs(left - right) < 1e-9;
}

/**
 * Fail closed before a public release upsert. Every entity, coordinate, and claim must already
 * exist in normalized canonical tables and the public statement/citation must match the current
 * immutable claim version.
 */
export async function assertReleaseRowsDerivableFromCanonical(
  writer: Pick<PgWriter, 'query'>,
  rows: readonly CanonicalReleaseGateRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const parsedClaims = rows.flatMap((row) =>
    claimRows(row).map((claim) => ({ entityId: row.entity_id, claim })),
  );
  const entityIds = [...new Set(rows.map((row) => row.entity_id))];
  const claimIds = [
    ...new Set(parsedClaims.map(({ claim }) => requiredString(claim.id, 'claim.id'))),
  ];

  const [entityResult, locationResult, claimResult] = await Promise.all([
    writer.query(
      `SELECT id, display_name, kind, kind_detail
       FROM bb_canonical.entities
       WHERE id = ANY($1::text[])`,
      [entityIds],
    ),
    writer.query(
      `SELECT entity_id, lat, lng
       FROM bb_canonical.entity_locations
       WHERE entity_id = ANY($1::text[])
         AND lat IS NOT NULL
         AND lng IS NOT NULL`,
      [entityIds],
    ),
    writer.query(
      `SELECT
         c.id,
         c.entity_id,
         v.predicate,
         v.object,
         v.body,
         COALESCE(v.confidence, c.confidence) AS confidence
       FROM bb_canonical.claims c
       JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
       WHERE c.id = ANY($1::text[])`,
      [claimIds],
    ),
  ]);

  const entities = new Map(
    (entityResult.rows as CanonicalEntityRow[]).map((entity) => [entity.id, entity]),
  );
  const locations = new Map<string, CanonicalLocationRow[]>();
  for (const location of locationResult.rows as CanonicalLocationRow[]) {
    const bucket = locations.get(location.entity_id) ?? [];
    bucket.push(location);
    locations.set(location.entity_id, bucket);
  }
  const claims = new Map(
    (claimResult.rows as CanonicalClaimRow[]).map((claim) => [claim.id, claim]),
  );

  const failures: string[] = [];
  for (const row of rows) {
    const canonical = entities.get(row.entity_id);
    if (!canonical) {
      failures.push(`${row.entity_id}: canonical entity is missing`);
      continue;
    }
    if (canonical.display_name !== row.display_name) {
      failures.push(`${row.entity_id}: display name diverges from canonical`);
    }
    if (canonical.kind !== row.kind) {
      failures.push(`${row.entity_id}: kind diverges from canonical`);
    }
    const editorial = asRecord(asRecord(canonical.kind_detail).editorial);
    if ((row.summary ?? '') !== (typeof editorial.summary === 'string' ? editorial.summary : '')) {
      failures.push(`${row.entity_id}: summary diverges from canonical editorial data`);
    }
    const classification = asRecord(asRecord(canonical.kind_detail).classification);
    if (stableJson(row.taxonomy ?? {}) !== stableJson(classification.taxonomy ?? {})) {
      failures.push(`${row.entity_id}: taxonomy diverges from canonical classification data`);
    }
    if (row.primary_image !== undefined) {
      const media = asRecord(asRecord(canonical.kind_detail).media);
      if (stableJson(row.primary_image) !== stableJson(media.primaryImage)) {
        failures.push(`${row.entity_id}: primary image diverges from canonical media data`);
      }
    }
    const hasMatchingLocation = (locations.get(row.entity_id) ?? []).some(
      (location) => samePoint(row.lat, location.lat) && samePoint(row.lng, location.lng),
    );
    if (!hasMatchingLocation) {
      failures.push(`${row.entity_id}: public coordinates do not match a canonical location`);
    }
  }

  for (const { entityId, claim } of parsedClaims) {
    const id = requiredString(claim.id, 'claim.id');
    const canonical = claims.get(id);
    if (!canonical) {
      failures.push(`${entityId}/${id}: canonical current claim version is missing`);
      continue;
    }
    if (canonical.entity_id !== entityId) {
      failures.push(`${entityId}/${id}: claim belongs to ${canonical.entity_id}`);
    }
    if (canonical.predicate !== requiredString(claim.predicate, `${id}.predicate`)) {
      failures.push(`${entityId}/${id}: predicate diverges from canonical`);
    }
    if (stableJson(canonical.object) !== stableJson(claim.object)) {
      failures.push(`${entityId}/${id}: object diverges from canonical`);
    }
    const citation = asRecord(asRecord(canonical.body).citation);
    const citationChecks = [
      ['citationSource', 'source'],
      ['citationHref', 'href'],
      ['citationLabel', 'label'],
    ] as const;
    for (const [publicKey, canonicalKey] of citationChecks) {
      if (claim[publicKey] !== citation[canonicalKey]) {
        failures.push(`${entityId}/${id}: ${publicKey} diverges from canonical evidence reference`);
      }
    }
    const confidence = asRecord(canonical.confidence);
    if (typeof claim.confidenceLevel === 'string' && claim.confidenceLevel !== confidence.level) {
      failures.push(`${entityId}/${id}: confidence level diverges from canonical`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Public release is not derivable from canonical data (${failures.length} failure${
        failures.length === 1 ? '' : 's'
      }): ${failures.slice(0, 12).join('; ')}${failures.length > 12 ? '; …' : ''}`,
    );
  }
}
