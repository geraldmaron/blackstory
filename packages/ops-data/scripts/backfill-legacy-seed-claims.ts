/**
 * Backfill the 4 released entities whose `claims` column still holds the legacy Firestore-
 * migration artifact `{}` instead of `[]` (repo-n7p6.14): ent_dunbar_alumni_federation_001,
 * ent_dc_landmark_listing_1975, ent_15th_st_church_001, ent_dunbar_school_001.
 *
 * The cited claim text was authored and already recovered once, in
 * packages/migrate-firestore-postgres/src/canonical-convergence.ts (LEGACY_SEED_CLAIM_SUPPLEMENTS)
 * — that recovery path runs at Firestore-import time and was never re-run against the live
 * release. This script applies the same supplements directly to the active release row, in the
 * shape of the precedent backfill-release-related-empty-array.ts.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd -
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-legacy-seed-claims.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_LEGACY_SEED_CLAIMS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-legacy-seed-claims.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_LEGACY_SEED_CLAIMS_APPLY === '1';

type ReleaseClaim = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
};

// Mirrors packages/migrate-firestore-postgres/src/canonical-convergence.ts
// LEGACY_SEED_CLAIM_SUPPLEMENTS verbatim (minus the migration-only `recoverySource` field), which
// is that script's source of truth. Kept as a literal here rather than a cross-package import so
// this one-off backfill has no new package dependency.
const LEGACY_SEED_CLAIMS_BY_ENTITY: Record<string, readonly ReleaseClaim[]> = {
  ent_15th_st_church_001: [
    {
      id: 'claim_seed_001',
      predicate: 'founded_year',
      object: '1841',
      confidenceLevel: 'high',
      citationSource: 'HMdb.org — historical marker database',
      citationHref: 'https://www.hmdb.org/m.asp?m=112661',
      citationLabel: 'Historical marker',
    },
    {
      id: 'claim_church_hosted_dunbar_founding_1870',
      predicate: 'hosted_founding_of',
      object: 'Preparatory High School for Colored Youth (1870), in the church basement',
      confidenceLevel: 'high',
      citationSource: 'Howard University Moorland-Spingarn Research Center — finding aid',
      citationHref: 'https://dh.howard.edu/finaid_manu/74/',
      citationLabel: 'Archival finding aid',
    },
  ],
  ent_dunbar_school_001: [
    {
      id: 'claim_dunbar_founded_1870',
      predicate: 'founded_as',
      object: 'Preparatory High School for Colored Youth (1870)',
      confidenceLevel: 'high',
      citationSource: 'DC Historic Sites — DC Preservation League',
      citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
      citationLabel: 'Preservation register',
    },
    {
      id: 'claim_dunbar_renamed_m_street_1891',
      predicate: 'renamed_and_relocated',
      object: 'M Street High School (1891), permanent building',
      confidenceLevel: 'medium',
      citationSource: 'Boundary Stones — WETA/PBS D.C. public history',
      citationHref:
        'https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
      citationLabel: 'Public history feature',
    },
    {
      id: 'claim_dunbar_renamed_dunbar_1916',
      predicate: 'renamed_and_relocated',
      object:
        'Paul Laurence Dunbar High School (1916), 1st & N Street NW, designed by architect Snowden Ashford',
      confidenceLevel: 'high',
      citationSource: 'Wikipedia — Dunbar High School (Washington, D.C.)',
      citationHref: 'https://en.wikipedia.org/wiki/Dunbar_High_School_(Washington,_D.C.)',
      citationLabel: 'Encyclopedia reference',
    },
    {
      id: 'claim_dunbar_demolitions_1977_2013',
      predicate: 'building_history',
      object:
        'The 1916 building was demolished in 1977; its 1970s replacement was itself demolished in 2013; the current building opened in 2013 on the same footprint',
      confidenceLevel: 'medium',
      citationSource: 'National Trust for Historic Preservation',
      citationHref:
        'https://savingplaces.org/stories/americas-first-african-american-public-high-school',
      citationLabel: 'Preservation feature',
    },
  ],
  ent_dc_landmark_listing_1975: [
    {
      id: 'claim_landmark_listed_1975',
      predicate: 'listed_on',
      object: 'D.C. Inventory of Historic Sites (April 29, 1975)',
      confidenceLevel: 'medium',
      citationSource: 'DC Historic Sites — DC Preservation League',
      citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
      citationLabel: 'Preservation register',
    },
  ],
  ent_dunbar_alumni_federation_001: [
    {
      id: 'claim_alumni_organized_2002',
      predicate: 'organized_year',
      object: '2002',
      confidenceLevel: 'medium',
      citationSource: 'Dunbar Alumni Federation — About',
      citationHref: 'https://www.daf-dc.org/about-us',
      citationLabel: 'Organization self-report',
    },
    {
      id: 'claim_alumni_tax_exempt_2003',
      predicate: 'tax_exempt_since',
      object: 'July 2003 (IRS 501(c)(3))',
      confidenceLevel: 'high',
      citationSource: 'ProPublica Nonprofit Explorer',
      citationHref: 'https://projects.propublica.org/nonprofits/organizations/10712951',
      citationLabel: 'Nonprofit filing lookup',
    },
  ],
};

const ENTITY_IDS = Object.keys(LEGACY_SEED_CLAIMS_BY_ENTITY);

const SELECT_SQL = `
SELECT entity_id, claims, projection->'claimIds' AS claim_ids
FROM bb_public.release_entities
WHERE entity_id = ANY($1)
`;

const UPDATE_SQL = `
UPDATE bb_public.release_entities
SET
  claims = $2::jsonb,
  projection = jsonb_set(jsonb_set(projection, '{claims}', $2::jsonb, true), '{claimIds}', $3::jsonb, true)
WHERE entity_id = $1
`;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const client = new pg.Client({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  await client.connect();

  try {
    const before = await client.query<{ entity_id: string; claims: unknown; claim_ids: unknown }>(
      SELECT_SQL,
      [ENTITY_IDS],
    );
    console.log('=== Backfill legacy seed claims (repo-n7p6.14) ===');
    for (const row of before.rows) {
      const claimsType = Array.isArray(row.claims) ? 'array' : typeof row.claims;
      console.log(
        `${row.entity_id}: claims is ${claimsType} (${JSON.stringify(row.claims)}), claimIds=${JSON.stringify(row.claim_ids)}`,
      );
    }
    if (before.rows.length !== ENTITY_IDS.length) {
      const found = new Set(before.rows.map((r) => r.entity_id));
      const missing = ENTITY_IDS.filter((id) => !found.has(id));
      console.error(
        `Expected ${ENTITY_IDS.length} rows, found ${before.rows.length}. Missing: ${missing.join(', ')}`,
      );
      process.exit(1);
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        'DRY_RUN=1 (default): no writes. Set DRY_RUN=0 BACKFILL_LEGACY_SEED_CLAIMS_APPLY=1 to apply.',
      );
      return;
    }

    for (const entityId of ENTITY_IDS) {
      const claims = LEGACY_SEED_CLAIMS_BY_ENTITY[entityId]!;
      const claimIds = claims.map((c) => c.id);
      const result = await client.query(UPDATE_SQL, [
        entityId,
        JSON.stringify(claims),
        JSON.stringify(claimIds),
      ]);
      console.log(
        `${entityId}: updated ${result.rowCount ?? 0} row(s), ${claims.length} claim(s).`,
      );
    }

    const after = await client.query<{ entity_id: string; claims: unknown; claim_ids: unknown }>(
      SELECT_SQL,
      [ENTITY_IDS],
    );
    console.log('--- After ---');
    for (const row of after.rows) {
      console.log(
        `${row.entity_id}: claims is ${Array.isArray(row.claims) ? 'array' : typeof row.claims} (${(row.claims as unknown[]).length} items), claimIds=${JSON.stringify(row.claim_ids)}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
