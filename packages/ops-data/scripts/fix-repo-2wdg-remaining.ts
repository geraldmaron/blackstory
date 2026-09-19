/**
 * Targeted repairs for sourced DC record names, locations and descriptions, plus removal of an
 * unsupported Ellen Eglin death date. Preserve source distinctions and update all public
 * representations together. Canonical living-status changes require
 * sync-canonical-living-to-release.ts. Inspect the dry-run before using DRY_RUN=0 and
 * FIX_REPO_2WDG_APPLY=1; verify both database rows and the refreshed public surface.
 */
import pg from 'pg';
import { encodeGeohash, geohashPrefixes } from '@repo/domain/geography/geohash';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_REPO_2WDG_APPLY === '1';

/** Matches every other release row in this catalog; do not introduce a second convention. */
const CATALOG_GEOHASH_LENGTH = 5;

const ENGINE_ID = 'dc-black-history-sites-i28';
const ENGINE_OLD_NAME = 'Engine Compnay No. 4';
const ENGINE_NEW_NAME = 'Engine Company No. 4';
const ENGINE_EVIDENCE_ID = 'ev_ba07f86455c1925223fbf47f';

const DOUGLASS_ID = 'nrhp-black-heritage-66000033';
const DOUGLASS_LOC_ID = 'loc_release_50e1372a5c8c0bbd873fce26f8cb4e7d';
const DOUGLASS_LAT = 38.863382;
const DOUGLASS_LNG = -76.985177;

const SYPHAX_ID = 'nrhp-black-heritage-03000672';
const SYPHAX_LOC_ID = 'loc_release_3d1a4e0ed62695092ab19759a9e26713';
const SYPHAX_LAT = 38.873835;
const SYPHAX_LNG = -77.010372;

const CEMETERY_ID = 'ent_authority_net_20260723_contrabands_freedmen_cemetery';
const CEMETERY_JURISDICTION = 'Alexandria, Virginia';

const AFRO_ID = 'dc-black-history-sites-b20';
const AFRO_SUMMARY =
  'The Washington Afro-American Newspaper Office Building at 1612 14th Street NW in Washington, DC, was the site of a newspaper that played a crucial role in the African American community from 1892 to the present.';

const EGLIN_ID = 'ent_ellen_eglin_001';
const EGLIN_DEATH_CLAUSE = ' (died c. 1915)';
const EGLIN_LIVING_STATUS = 'presumed_deceased';
const EGLIN_LIVING_DERIVED = {
  lane: 'living-status-review',
  signal: 'wp_bdp_plausibility',
  status: EGLIN_LIVING_STATUS,
  birthYear: 1849,
  basis:
    'Born 1849; no death date in any cited source. BlackPast gives "Ellen Eglin (1849–?)"; Wikipedia leads "(before 1849 – after 1890)" and states the place and date of her death are unknown, and its infobox "c. 1915" carries no reference. Exceeds MAX_PLAUSIBLE_HUMAN_AGE_YEARS (115), so WP:BDP gives presumed_deceased, not an evidenced death.',
  basisClaimIds: ['claim_ellen_eglin_001_01', 'claim_ellen_eglin_001_02'],
  derivedAt: new Date().toISOString(),
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type PinTarget = {
  readonly entityId: string;
  readonly locationId: string;
  readonly lat: number;
  readonly lng: number;
  /** Undefined leaves the stored precision alone. */
  readonly precision?: string;
  /** Undefined leaves the stored match method alone. */
  readonly matchMethod?: string;
};

const PINS: readonly PinTarget[] = [
  {
    entityId: DOUGLASS_ID,
    locationId: DOUGLASS_LOC_ID,
    lat: DOUGLASS_LAT,
    lng: DOUGLASS_LNG,
    precision: 'site',
  },
  {
    entityId: SYPHAX_ID,
    locationId: SYPHAX_LOC_ID,
    lat: SYPHAX_LAT,
    lng: SYPHAX_LNG,
    matchMethod: 'manual_research',
  },
];

async function reportBefore(client: pg.Client, releaseId: string): Promise<void> {
  const { rows } = await client.query(
    `SELECT re.entity_id, re.display_name, re.lat, re.lng,
            re.location ->> 'precision' AS precision,
            re.location ->> 'matchMethod' AS match_method,
            re.projection ->> 'jurisdictionLabel' AS jurisdiction_label,
            left(re.summary, 90) AS summary_head
     FROM published.release_entities re
     WHERE re.release_id = $1 AND re.entity_id = ANY($2::text[])
     ORDER BY re.entity_id`,
    [releaseId, [ENGINE_ID, DOUGLASS_ID, SYPHAX_ID, CEMETERY_ID, AFRO_ID, EGLIN_ID]],
  );
  console.log('\nBefore:');
  for (const row of rows) console.log(`  ${JSON.stringify(row)}`);

  const eglin = await client.query<{ living_status: string }>(
    `SELECT living_status FROM canonical.entities WHERE id = $1`,
    [EGLIN_ID],
  );
  console.log(`  Eglin canonical living_status: ${eglin.rows[0]?.living_status}`);
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM published.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    console.log('=== repo-2wdg items 7, 8, 9 ===');
    console.log(`release: ${releaseId}`);

    const eglinSummary = (
      await client.query<{ summary: string }>(
        `SELECT summary FROM published.release_entities WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, EGLIN_ID],
      )
    ).rows[0]?.summary;
    if (eglinSummary === undefined) throw new Error(`${EGLIN_ID} not in the active release`);
    const eglinFixed = eglinSummary.replace(EGLIN_DEATH_CLAUSE, '');
    if (eglinFixed === eglinSummary && eglinSummary.includes('1915')) {
      throw new Error('Eglin summary still asserts 1915 but the clause did not match; stop.');
    }
    if (eglinFixed.length < 120) {
      throw new Error(`Eglin summary would fall below the 120-char floor (${eglinFixed.length})`);
    }

    await reportBefore(client, releaseId);

    console.log('\nPlanned:');
    console.log(`  ${ENGINE_ID}: "${ENGINE_OLD_NAME}" -> "${ENGINE_NEW_NAME}" (9 copies)`);
    for (const pin of PINS) {
      const geohash = encodeGeohash(pin.lat, pin.lng, CATALOG_GEOHASH_LENGTH);
      console.log(
        `  ${pin.entityId}: -> ${pin.lat},${pin.lng} geohash ${geohash}` +
          (pin.precision ? ` precision ${pin.precision}` : '') +
          (pin.matchMethod ? ` matchMethod ${pin.matchMethod}` : ''),
      );
    }
    console.log(`  ${CEMETERY_ID}: jurisdictionLabel -> "${CEMETERY_JURISDICTION}" (+ facet)`);
    console.log(`  ${AFRO_ID}: summary + record_index claim -> canonical text (5 mirrors)`);
    console.log(`  ${EGLIN_ID}: summary drops "${EGLIN_DEATH_CLAUSE.trim()}" (3 mirrors)`);
    console.log(`  ${EGLIN_ID}: canonical living_status -> ${EGLIN_LIVING_STATUS}`);
    console.log(`     new summary (${eglinFixed.length} chars): ${eglinFixed}`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run. Set DRY_RUN=0 FIX_REPO_2WDG_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      // --- item 8: the typo, all nine copies -----------------------------------------
      await client.query(
        `UPDATE canonical.entities SET display_name = $2, updated_at = now() WHERE id = $1`,
        [ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE published.release_entities
         SET projection = jsonb_set(
               jsonb_set(projection, '{displayName}', to_jsonb($3::text), true),
               '{nameLower}', to_jsonb(lower($3::text)), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE published.search_index
         SET name = $3, name_lower = lower($3)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE research.landscape_candidates
         SET display_name = $2,
             payload = jsonb_set(payload, '{displayName}', to_jsonb($2::text), true),
             updated_at = now()
         WHERE id = $1`,
        [ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(`UPDATE research.entity_evidence SET title = $2 WHERE id = $1`, [
        ENGINE_EVIDENCE_ID,
        ENGINE_NEW_NAME,
      ]);

      // --- item 7: the two pins ------------------------------------------------------
      for (const pin of PINS) {
        const geohash = encodeGeohash(pin.lat, pin.lng, CATALOG_GEOHASH_LENGTH);
        const locationJson = JSON.stringify({
          lat: pin.lat,
          lng: pin.lng,
          geohash,
          geohashPrefixes: geohashPrefixes(geohash),
        });
        // One write, into the projection. location/lat/lng/geohash are GENERATED from it, so the
        // "same object, not a second copy that drifts" this used to need two statements for is
        // now structural.
        await client.query(
          `UPDATE published.release_entities
           SET projection = jsonb_set(
                 projection, '{location}',
                 COALESCE(projection -> 'location', '{}'::jsonb) || $3::jsonb
                   || CASE WHEN $4::text IS NULL THEN '{}'::jsonb
                           ELSE jsonb_build_object('precision', $4::text) END
                   || CASE WHEN $5::text IS NULL THEN '{}'::jsonb
                           ELSE jsonb_build_object('matchMethod', $5::text) END,
                 true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, pin.entityId, locationJson, pin.precision ?? null, pin.matchMethod ?? null],
        );
        await client.query(
          `UPDATE published.search_index SET geohash = $3 WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, pin.entityId, geohash],
        );
        // The canonical mirror the admin console reads. Its geohash length is per-row; keep it.
        const canonicalLength = (
          await client.query<{ len: number }>(
            `SELECT coalesce(length(geohash), $2) AS len FROM canonical.entity_locations WHERE id = $1`,
            [pin.locationId, CATALOG_GEOHASH_LENGTH],
          )
        ).rows[0]?.len;
        if (canonicalLength === undefined) {
          throw new Error(`entity_locations row ${pin.locationId} not found`);
        }
        const canonicalGeohash = encodeGeohash(pin.lat, pin.lng, canonicalLength);
        await client.query(
          `UPDATE canonical.entity_locations
           SET lat = $2, lng = $3, geohash = $4, geohash_prefixes = $5::text[],
               precision = COALESCE($6, precision),
               match_method = COALESCE($7, match_method),
               updated_at = now()
           WHERE id = $1`,
          [
            pin.locationId,
            pin.lat,
            pin.lng,
            canonicalGeohash,
            geohashPrefixes(canonicalGeohash),
            pin.precision ?? null,
            pin.matchMethod ?? null,
          ],
        );
      }

      // --- item 7: the cemetery label ------------------------------------------------
      await client.query(
        `UPDATE published.release_entities
         SET projection = jsonb_set(projection, '{jurisdictionLabel}', to_jsonb($3::text), true)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, CEMETERY_ID, CEMETERY_JURISDICTION],
      );
      await client.query(
        `UPDATE published.search_index
         SET facets = CASE
               WHEN jsonb_typeof(facets) = 'object'
                 THEN jsonb_set(facets, '{jurisdictionState}', to_jsonb($3::text), true)
               ELSE facets END
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, CEMETERY_ID, CEMETERY_JURISDICTION],
      );

      // --- item 7: the Afro-American summary, all five mirrors -----------------------
      await client.query(
        `UPDATE published.release_entities
         SET projection = jsonb_set(
               jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
               '{claims,0,object}', to_jsonb($3::text), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, AFRO_ID, AFRO_SUMMARY],
      );
      await client.query(`UPDATE research.landscape_candidates SET summary = $2 WHERE id = $1`, [
        AFRO_ID,
        AFRO_SUMMARY,
      ]);

      // --- item 9: Ellen Eglin -------------------------------------------------------
      await client.query(
        `UPDATE published.release_entities
         SET projection = jsonb_set(projection, '{summary}', to_jsonb($3::text), true)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, EGLIN_ID, eglinFixed],
      );
      await client.query(
        `UPDATE canonical.entities
         SET kind_detail = jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
             living_status = $3,
             living_status_derived = $4::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [EGLIN_ID, eglinFixed, EGLIN_LIVING_STATUS, JSON.stringify(EGLIN_LIVING_DERIVED)],
      );

      await client.query('COMMIT');
      console.log('\nApplied.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    await reportBefore(client, releaseId);
    console.log(
      '\nNEXT: DRY_RUN=0 SYNC_CANONICAL_LIVING_TO_RELEASE_APPLY=1 node --conditions development' +
        ' --import tsx packages/ops-data/scripts/sync-canonical-living-to-release.ts' +
        ' --ids=ent_ellen_eglin_001',
    );
    // 6 released records changed; the CDN catalog artifacts are stale until republished.
    remindToRepublishCatalogArtifacts(6);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
