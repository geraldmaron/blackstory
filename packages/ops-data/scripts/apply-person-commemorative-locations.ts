/**
 * Apply git-durable commemorative-site locations to person entities in the active release.
 *
 * Policy (owner-set, 2026-07-28): person entities carry the coordinates of their most
 * publicly recognizable commemorative site, never a raw residence. Priority order:
 *   1. a formally designated historic property (NHL / NRHP / city landmark),
 *   2. an institution formally dedicated to or holding the person's legacy,
 *   3. a publicly documented gravesite.
 * Deceased persons only. A living person may only ever be pinned to an institution
 * (never any residence) and requires explicit owner review first — this script
 * refuses any entity whose canonical living_status is not 'deceased'.
 *
 * Every pin ships with a sourced claim (T1–T3 citation) mirroring the shape of the
 * existing hand-authored release claims (see ent_ida_b_wells_001), so the location
 * and its evidence flow through backfill-canonical into bb_canonical together.
 *
 * Input fixture: fixtures/person-commemorative-locations.json (git-durable record
 * of every pin, per the same durability contract as enrich-entity-locations.ts).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-person-commemorative-locations.ts        # dry-run
 *   DRY_RUN=0 PERSON_LOCATIONS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-person-commemorative-locations.ts        # apply
 *
 * After apply, reconcile canonical:
 *   pnpm --filter migrate-firestore-postgres backfill-canonical -- --apply \
 *     --confirm-hosted-write=canonical-convergence
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { buildGeoPointFields, lookupSourceTier } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(SCRIPT_DIR, '../fixtures/person-commemorative-locations.json');
const REPORT_PATH = join(SCRIPT_DIR, '../../..', '.cache/person-commemorative-locations-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.PERSON_LOCATIONS_APPLY === '1';
// Matches the institution-precision pins already in the release (e.g. ent_ida_b_wells_001).
const GEOHASH_PRECISION = 5;

type CommemorativeClaim = {
  readonly predicate: string;
  readonly object: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly citationSource: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
};

type CommemorativeRecord = {
  readonly entityId: string;
  readonly siteName: string;
  readonly locationLabel: string;
  readonly designation: string;
  readonly lat: number;
  readonly lng: number;
  readonly coordinateSource: string;
  readonly verifiedSources: readonly string[];
  readonly claim: CommemorativeClaim;
};

type Fixture = {
  readonly version: 1;
  readonly policy: string;
  readonly records: readonly CommemorativeRecord[];
};

function requireDatabaseUrl(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function loadFixture(): Fixture {
  const parsed = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error(`${FIXTURE_PATH}: expected {version: 1, records: [...]}`);
  }
  return parsed;
}

function validateRecord(record: CommemorativeRecord): string[] {
  const problems: string[] = [];
  if (!record.entityId?.startsWith('ent_')) problems.push('entityId must start with ent_');
  if (!record.siteName?.trim()) problems.push('siteName is required');
  if (!record.locationLabel?.trim()) problems.push('locationLabel is required');
  if (!Number.isFinite(record.lat) || Math.abs(record.lat) > 90) problems.push('lat out of range');
  if (!Number.isFinite(record.lng) || Math.abs(record.lng) > 180) problems.push('lng out of range');
  const claim = record.claim;
  if (!claim?.predicate?.trim() || !claim?.object?.trim()) {
    problems.push('claim predicate/object required');
  }
  if (!/^https?:\/\//u.test(claim?.citationHref ?? '')) {
    problems.push('claim.citationHref must be an http(s) URL');
  } else {
    const tier = lookupSourceTier(claim.citationHref).tier;
    if (tier === 'T4') problems.push(`claim.citationHref is T4 (untrusted): ${claim.citationHref}`);
  }
  if (!claim?.citationLabel?.trim() || !claim?.citationSource?.trim()) {
    problems.push('claim citationLabel/citationSource required');
  }
  return problems;
}

async function main(): Promise<void> {
  const fixture = loadFixture();
  const connection = normalizePgConnectionString(requireDatabaseUrl());
  const pool = new pg.Pool({
    connectionString: connection.connectionString,
    max: 1,
    ...(connection.ssl ? { ssl: connection.ssl } : {}),
  });
  const client = await pool.connect();
  const results: Array<Record<string, unknown>> = [];

  try {
    await client.query('BEGIN');
    const active = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.active_release WHERE id = 'active'`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    for (const record of fixture.records) {
      const problems = validateRecord(record);
      const claimId = `claim_${record.entityId}_commemorative_site`;

      const row = await client.query<{
        entity_id: string;
        kind: string;
        living_status: string | null;
        lat: number | null;
        has_claim: boolean;
      }>(
        `SELECT re.entity_id, re.kind, ce.living_status, re.lat,
                EXISTS (
                  SELECT 1 FROM jsonb_array_elements(COALESCE(re.claims, '[]'::jsonb)) c
                  WHERE c->>'id' = $3
                ) AS has_claim
         FROM bb_public.release_entities re
         LEFT JOIN bb_canonical.entities ce ON ce.id = re.entity_id
         WHERE re.release_id = $1 AND re.entity_id = $2`,
        [releaseId, record.entityId, claimId],
      );
      const found = row.rows[0];
      if (!found) problems.push('entity not in active release');
      else {
        if (found.kind !== 'person') problems.push(`kind is ${found.kind}, not person`);
        if (found.living_status !== 'deceased') {
          problems.push(
            `living_status is ${found.living_status ?? 'missing'} — policy allows deceased only; living persons need owner review`,
          );
        }
        if (found.lat !== null) problems.push('release row already has coordinates; refusing to overwrite');
        if (found.has_claim) problems.push(`claim ${claimId} already present (already applied?)`);
      }

      if (problems.length > 0) {
        results.push({ entityId: record.entityId, status: 'skipped', problems });
        continue;
      }

      const geo = buildGeoPointFields(record.lat, record.lng, GEOHASH_PRECISION);
      const location = {
        lat: geo.lat,
        lng: geo.lng,
        geohash: geo.geohash,
        precision: 'institution',
        matchMethod: 'manual_research',
        geohashPrefixes: geo.geohashPrefixes,
      };
      const claim = { id: claimId, ...record.claim };

      if (!DRY_RUN && APPLY) {
        await client.query(
          `UPDATE bb_public.release_entities
           SET lat = $3, lng = $4, geohash = $5,
               location = $6::jsonb,
               claims = COALESCE(claims, '[]'::jsonb) || $7::jsonb,
               projection = COALESCE(projection, '{}'::jsonb)
                 || jsonb_build_object('locationLabel', $8::text, 'location', $6::jsonb)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, record.entityId, geo.lat, geo.lng, geo.geohash,
           JSON.stringify(location), JSON.stringify([claim]), record.locationLabel],
        );
        await client.query(
          `UPDATE bb_public.search_index SET geohash = $3
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, record.entityId, geo.geohash],
        );
      }

      results.push({
        entityId: record.entityId,
        status: DRY_RUN || !APPLY ? 'would_apply' : 'applied',
        siteName: record.siteName,
        geohash: geo.geohash,
        claimId,
        citationTier: lookupSourceTier(record.claim.citationHref).tier,
      });
    }

    if (DRY_RUN || !APPLY) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      JSON.stringify({ mode: DRY_RUN || !APPLY ? 'dry-run' : 'apply', releaseId, results }, null, 2),
    );
    console.log(JSON.stringify({ mode: DRY_RUN || !APPLY ? 'dry-run' : 'apply', results }, null, 2));
    if (DRY_RUN || !APPLY) {
      console.log('Dry-run: no writes. Set DRY_RUN=0 PERSON_LOCATIONS_APPLY=1 to apply.');
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
