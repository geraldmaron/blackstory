/**
 * repo-2wdg items 7, 8 and 9 — the corrections left after the six duplicate merges.
 *
 * Item 8, the typo. The DC HPO "African American Heritage Trail" source spells its own
 * `Resource` field "Engine Compnay No. 4" while spelling it "Engine Company No. 4" twice in the
 * `Details` field of the same feature. We publish the correct name. That is a deliberate
 * divergence from the upstream name field, so re-running the dc-sites lane will reintroduce the
 * typo unless a per-item override is added — filed as a follow-up, not fixed here. The name lives
 * in nine places (measured with a full-row `to_jsonb(t)::text ILIKE '%compnay%'` sweep over 47
 * base tables, which found exactly these and nothing else); all nine move in one transaction.
 * `search_index.facets` is deliberately NOT among them: this row's facets object carries no
 * `displayName`/`nameLower`, `isFullSearchIndexDoc` is false for it, so the reader takes the
 * `name` column — and `upsertSearchIndex` writes `facets = EXCLUDED.facets`, a whole-object
 * replace, so hand-added keys would be deleted on the next incremental publish anyway.
 *
 * The public address changes with the name: /place/engine-compnay-no-4 becomes
 * /place/engine-company-no-4, because `publicPlaceSlug` runs over the published display name.
 * A running dev server does not see a record renamed under it — the record's own page returns
 * "Place not found" until the server restarts, with every layer correct (repo-iejg8, now in
 * CLAUDE.md). Verify a rename in the database, not in the browser.
 *
 * Item 7, two bad pins. Both are corrected to a coordinate the repo already holds, from the
 * absorbed/pending landscape row for the same resource, and both are corroborated three ways:
 *
 *  - Frederick Douglass NHS (nrhp-black-heritage-66000033) sat at 38.904247,-77.016517, which
 *    reverse-geocodes to an apartment building at 415 L Street NW in Mount Vernon Square, 5.6 km
 *    from Cedar Hill. It moves to the DC HPO AAHT point for the same site (UniqueID p32,
 *    1411 W Street SE), which OSM reverse-geocodes as "Frederick Douglass National Historic
 *    Site" and which the Census geocode of 1411 W St SE corroborates to ~90 m. NPS's own
 *    nrhp_locations layer has no feature for this refnum. Precision goes `county` -> `site`.
 *
 *  - William Syphax School (nrhp-black-heritage-03000672) kept the NPS ArcGIS point through the
 *    repo-k552 merge. NPS's own metadata marks that point BND_TYPE "Arbitrary point",
 *    MAP_METHOD "Derived by XY event point or centroid generation", while claiming ±12 m. The
 *    nomination itself settles it: its verbal boundary description reads "1360 Half Street,
 *    S. W., facing west mid-block between N and O Streets ... lot 822 in Square 653", and DC
 *    Square 0653 spans lng -77.0105..-77.0093, lat 38.8731..38.8745. The stored point
 *    (38.875879,-77.008252) is outside that square and reverse-geocodes to Van Street SE in
 *    Navy Yard; the absorbed record's point (38.873835,-77.010372 — DC HPO AAHT c18) is inside
 *    it, on Half Street SW, and the Census geocode of 1360 Half St SW agrees to ~28 m. The
 *    nomination's own UTM (Zone 18 / 325760 / 4304700) is not usable against it: rounded to the
 *    nearest 100 m northing, it lands in SE on either datum reading and contradicts the prose
 *    on the same page. So the match method also stops claiming NPS provenance and becomes
 *    `manual_research`; the street stays "1360 Half St., SW".
 *
 * Item 7, one bad label. Contrabands and Freedmen Cemetery is pinned correctly in Alexandria
 * (343 m from 1001 S Washington St, 44 m from the OSM memorial node) and labeled "District of
 * Columbia". `bb_canonical.entities.kind_detail.jurisdiction.label` already says "Alexandria,
 * Virginia"; the release projection and the search facet are what disagree. The pin is not
 * touched.
 *
 * Item 7, one bad summary. The Washington Afro-American Newspaper Office Building's public
 * summary was lifted wholesale from its Maryland State Archives citation and is about the
 * BALTIMORE paper: it names neither this building, nor 14th Street, nor Washington. Canonical
 * already holds the correct sentence, so this publishes that rather than writing new prose. The
 * same string is the record's `record_index` claim object, so this is a claim edit, not a
 * cosmetic one, and all five mirrors move together.
 *
 * Item 9, an uncited death date. Ellen Eglin's summary asserted "(died c. 1915)" and her
 * `living_status_derived` recorded `deathYear: 1915` with an EMPTY `basisClaimIds` and a basis
 * that cites the very prose it produced. Neither of the record's two cited sources supports it:
 * BlackPast titles her "Ellen Eglin (1849–?)", and Wikipedia — the other citation — leads with
 * "(before 1849 – after 1890)" and states outright that "Little is known about the later stages
 * of Eglin's life, including the place or date of her death." The 1915 in Wikipedia's infobox
 * carries no reference. So the clause goes, and the status becomes the answer the repo already
 * computes for a person born 1849 with no death year: `deriveLivingStatus` returns
 * `presumed_deceased` (WP:BDP, MAX_PLAUSIBLE_HUMAN_AGE_YEARS = 115). She is the first of 483
 * live person records to carry it.
 *
 * REQUIRES the widened `livingStatus` enum in packages/schemas/src/public-projections.ts. The
 * release-side half of item 9 is deliberately NOT written here — run the existing
 * `sync-canonical-living-to-release.ts --ids=ent_ellen_eglin_001` after this, which is the
 * script that already knows to write BOTH the `search_index.status` column and `facets.status`.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-repo-2wdg-remaining.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_REPO_2WDG_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-repo-2wdg-remaining.ts
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
     FROM bb_public.release_entities re
     WHERE re.release_id = $1 AND re.entity_id = ANY($2::text[])
     ORDER BY re.entity_id`,
    [releaseId, [ENGINE_ID, DOUGLASS_ID, SYPHAX_ID, CEMETERY_ID, AFRO_ID, EGLIN_ID]],
  );
  console.log('\nBefore:');
  for (const row of rows) console.log(`  ${JSON.stringify(row)}`);

  const eglin = await client.query<{ living_status: string }>(
    `SELECT living_status FROM bb_canonical.entities WHERE id = $1`,
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
        `SELECT release_id FROM bb_public.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    console.log('=== repo-2wdg items 7, 8, 9 ===');
    console.log(`release: ${releaseId}`);

    const eglinSummary = (
      await client.query<{ summary: string }>(
        `SELECT summary FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
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
        `UPDATE bb_canonical.entities SET display_name = $2, updated_at = now() WHERE id = $1`,
        [ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE bb_public.release_entities
         SET display_name = $3,
             projection = jsonb_set(
               jsonb_set(projection, '{displayName}', to_jsonb($3::text), true),
               '{nameLower}', to_jsonb(lower($3::text)), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE bb_public.search_index
         SET name = $3, name_lower = lower($3)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(
        `UPDATE bb_research.landscape_candidates
         SET display_name = $2,
             payload = jsonb_set(payload, '{displayName}', to_jsonb($2::text), true),
             updated_at = now()
         WHERE id = $1`,
        [ENGINE_ID, ENGINE_NEW_NAME],
      );
      await client.query(`UPDATE bb_research.entity_evidence SET title = $2 WHERE id = $1`, [
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
        await client.query(
          `UPDATE bb_public.release_entities
           SET location = location || $3::jsonb
                 || CASE WHEN $4::text IS NULL THEN '{}'::jsonb
                         ELSE jsonb_build_object('precision', $4::text) END
                 || CASE WHEN $5::text IS NULL THEN '{}'::jsonb
                         ELSE jsonb_build_object('matchMethod', $5::text) END,
               lat = ($3::jsonb ->> 'lat')::double precision,
               lng = ($3::jsonb ->> 'lng')::double precision,
               geohash = $3::jsonb ->> 'geohash'
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, pin.entityId, locationJson, pin.precision ?? null, pin.matchMethod ?? null],
        );
        // projection.location must be the same object, not a second copy that drifts.
        await client.query(
          `UPDATE bb_public.release_entities
           SET projection = jsonb_set(projection, '{location}', location, true)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, pin.entityId],
        );
        await client.query(
          `UPDATE bb_public.search_index SET geohash = $3 WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, pin.entityId, geohash],
        );
        // The canonical mirror the admin console reads. Its geohash length is per-row; keep it.
        const canonicalLength = (
          await client.query<{ len: number }>(
            `SELECT coalesce(length(geohash), $2) AS len FROM bb_canonical.entity_locations WHERE id = $1`,
            [pin.locationId, CATALOG_GEOHASH_LENGTH],
          )
        ).rows[0]?.len;
        if (canonicalLength === undefined) {
          throw new Error(`entity_locations row ${pin.locationId} not found`);
        }
        const canonicalGeohash = encodeGeohash(pin.lat, pin.lng, canonicalLength);
        await client.query(
          `UPDATE bb_canonical.entity_locations
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
        `UPDATE bb_public.release_entities
         SET projection = jsonb_set(projection, '{jurisdictionLabel}', to_jsonb($3::text), true)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, CEMETERY_ID, CEMETERY_JURISDICTION],
      );
      await client.query(
        `UPDATE bb_public.search_index
         SET facets = CASE
               WHEN jsonb_typeof(facets) = 'object'
                 THEN jsonb_set(facets, '{jurisdictionState}', to_jsonb($3::text), true)
               ELSE facets END
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, CEMETERY_ID, CEMETERY_JURISDICTION],
      );

      // --- item 7: the Afro-American summary, all five mirrors -----------------------
      await client.query(
        `UPDATE bb_public.release_entities
         SET summary = $3,
             claims = jsonb_set(claims, '{0,object}', to_jsonb($3::text), true),
             projection = jsonb_set(
               jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
               '{claims,0,object}', to_jsonb($3::text), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, AFRO_ID, AFRO_SUMMARY],
      );
      await client.query(`UPDATE bb_research.landscape_candidates SET summary = $2 WHERE id = $1`, [
        AFRO_ID,
        AFRO_SUMMARY,
      ]);

      // --- item 9: Ellen Eglin -------------------------------------------------------
      await client.query(
        `UPDATE bb_public.release_entities
         SET summary = $3,
             projection = jsonb_set(projection, '{summary}', to_jsonb($3::text), true)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, EGLIN_ID, eglinFixed],
      );
      await client.query(
        `UPDATE bb_canonical.entities
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
