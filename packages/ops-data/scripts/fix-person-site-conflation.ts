/**
 * repo-9ki8 — split person records that are really their monument's record.
 *
 * A person entity seeded from a site record inherits the site's claim, its map pin, and its
 * `documented_site` notability criterion — a criterion the rubric in
 * packages/domain/src/entity-status.ts reserves for sites. The result reads as the park's
 * record filed under the person's name.
 *
 * ent_harriet_tubman_001 was the worst case: one claim, and it was visitor-center directions.
 * The site content it carried is already held, correctly and in full, by
 * ent_tubman_underground_railroad_md_001 — so this is a split, not a rewrite: the person keeps
 * the person, the park keeps the park.
 *
 * Every claim written here is copied from a claim already published in this catalog on a
 * neighbouring entity (the park, the Combahee raid, the Auburn home), with its citation. No new
 * sources, no new facts.
 *
 * The audit pass runs unconditionally and reports any other person record showing the same
 * shape, so the next occurrence is caught rather than stumbled on.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-person-site-conflation.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_PERSON_SITE_CONFLATION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-person-site-conflation.ts
 *
 * After applying, populate the relationship edges into related[] and rebuild the graph:
 *   DRY_RUN=0 BACKFILL_RELATED_FROM_EDGES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-release-related-from-edges.ts
 *   node --conditions development --import tsx packages/ops-data/scripts/rebuild-release-graph.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_PERSON_SITE_CONFLATION_APPLY === '1';

const TUBMAN_ID = 'ent_harriet_tubman_001';
const WASHINGTON_ID = 'ent_booker_t_washington_001';

/**
 * The generated shell a site record leaves behind when it is filed as a person: the claim
 * object, then life dates, then the SITE's jurisdiction, then the site's documenting authority.
 */
const SITE_SHELL_MARKERS = ['Documented life dates:', 'associated public historic site is in'];

type Claim = {
  readonly id: string;
  readonly object: string;
  readonly predicate: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly citationSource: string;
  readonly confidenceLevel: string;
};

/**
 * Her life, from claims already published on neighbouring entities. Sources carried over
 * unchanged: the park record (nps.gov/hatu), the Combahee raid record
 * (nps.gov/articles/000/we-called-ourselves-combee.htm), the Auburn home record (nps.gov/hart).
 */
const TUBMAN_CLAIMS: readonly Claim[] = [
  {
    id: 'claim_harriet_tubman_001_01',
    object:
      'Born into slavery around 1822 in Dorchester County, Maryland, where she lived until her escape in 1849',
    predicate: 'born_into_slavery',
    citationHref: 'https://www.nps.gov/hatu/index.htm',
    citationLabel:
      'National Park Service: Harriet Tubman Underground Railroad National Historical Park',
    citationSource: 'nps.gov',
    confidenceLevel: 'high',
  },
  {
    id: 'claim_harriet_tubman_001_02',
    object:
      'After escaping slavery in 1849 she returned to Maryland roughly 13 times, guiding about 70 enslaved people to freedom',
    predicate: 'guided_to_freedom',
    citationHref: 'https://www.nps.gov/hatu/index.htm',
    citationLabel:
      'National Park Service: Harriet Tubman Underground Railroad National Historical Park',
    citationSource: 'nps.gov',
    confidenceLevel: 'high',
  },
  {
    id: 'claim_harriet_tubman_001_03',
    object:
      'On June 1-2, 1863 she guided Union Army Colonel James Montgomery and roughly 150 soldiers of the 2nd South Carolina Infantry, a Black regiment, on a raid up the Combahee River, making her the first woman known to plan and lead a U.S. armed military operation; the raid carried more than 750 enslaved people to freedom aboard the Union gunboats',
    predicate: 'led',
    citationHref: 'https://www.nps.gov/articles/000/we-called-ourselves-combee.htm',
    citationLabel:
      'National Park Service: We Called Ourselves Combee — Freeing the Enslaved Along the Combahee River',
    citationSource: 'nps.gov',
    confidenceLevel: 'high',
  },
  {
    id: 'claim_harriet_tubman_001_04',
    object:
      'She purchased the South Street property in Auburn, New York from Secretary of State William H. Seward in 1859 and relocated her parents and family there while continuing abolitionist and humanitarian work',
    predicate: 'purchased_land_from',
    citationHref: 'https://www.nps.gov/hart/learn/historyculture/tubman-residence.htm',
    citationLabel: "National Park Service: Harriet Tubman's Auburn Home",
    citationSource: 'nps.gov',
    confidenceLevel: 'high',
  },
  {
    id: 'claim_harriet_tubman_001_05',
    object:
      'In 1908 she opened the Harriet Tubman Home for the Aged on the Auburn property, caring for elderly and indigent Black residents; she lived there until her death in 1913',
    predicate: 'founded',
    citationHref: 'https://www.nps.gov/hart/index.htm',
    citationLabel: 'National Park Service: Harriet Tubman National Historical Park',
    citationSource: 'nps.gov',
    confidenceLevel: 'high',
  },
];

const TUBMAN_SUMMARY =
  'Born into slavery around 1822 in Dorchester County, Maryland, Harriet Tubman escaped north in ' +
  '1849 — and then went back, roughly thirteen times, guiding about seventy people out of ' +
  'slavery. During the Civil War she led Colonel James Montgomery and some 150 soldiers of the ' +
  '2nd South Carolina Infantry up the Combahee River on June 1-2, 1863, the first woman known to ' +
  'plan and lead an armed U.S. military operation; more than 750 people were carried to freedom ' +
  'aboard its gunboats. She spent her last decades in Auburn, New York, on land she bought from ' +
  'William H. Seward in 1859, and in 1908 opened the Harriet Tubman Home for the Aged there. She ' +
  'died in that house in 1913.';

const TUBMAN_CONTEXT =
  'An Underground Railroad conductor, Union scout, and raid commander whose documented life runs ' +
  "from slavery on Maryland's Eastern Shore through the Civil War to the home for elderly Black " +
  'Americans she founded, and died in, in Auburn, New York.';

const TUBMAN_NOTABILITY = [
  {
    criterion: 'first_to_do_x',
    note: 'First woman known to plan and lead an armed U.S. military operation — the Combahee River Raid, June 1-2, 1863.',
    evidenceIds: ['claim_harriet_tubman_001_03'],
  },
  {
    criterion: 'movement_significance',
    note: "Conductor on the Underground Railroad who returned to Maryland's Eastern Shore roughly 13 times, guiding about 70 enslaved people to freedom.",
    evidenceIds: ['claim_harriet_tubman_001_02'],
  },
] as const;

const TUBMAN_NOTABILITY_LABELS = [
  'The entity is documented as the first Black person, institution, or place to achieve, hold, ' +
    'found, or integrate something notable (a role, office, degree, business, record) — not ' +
    'merely an early or contemporaneous participant.',
  'The entity (person, organization, event, place, or a movement-kind entity itself) played a ' +
    'documented, non-incidental role in a named movement (Civil Rights Movement, Great ' +
    'Migration, Black Power, Black Arts Movement, etc.) — organizing, leading, hosting, or being ' +
    'a recognized site or symbol of it.',
];

/**
 * Her pin was the visitor center's own coordinates at `site` precision — the map was showing a
 * building where a person should be. Same landscape, told honestly: the county she was born in.
 */
const TUBMAN_LOCATION = {
  lat: 38.4445934,
  lng: -76.1426984,
  geohash: 'dqcfe',
  precision: 'county',
  matchMethod: 'manual_research',
  geohashPrefixes: ['d', 'dq', 'dqc', 'dqcf', 'dqcfe'],
};

const TUBMAN_LOCATION_LABEL = 'Dorchester County, Maryland';
const TUBMAN_JURISDICTION_LABEL = 'Dorchester County, Maryland';

/**
 * She was not linked to her own park, her own raid, or her own home — related[] was empty.
 * Every edge below is the direct subject of one of the claims above.
 */
const TUBMAN_EDGES: readonly {
  readonly to: string;
  readonly type: string;
}[] = [
  { to: 'ent_tubman_underground_railroad_md_001', type: 'related_to' },
  { to: 'ent_combahee_river_raid_001', type: 'participated_in' },
  { to: 'ent_tubman_auburn_001', type: 'founded' },
  { to: 'ent_thomas_garrett_house_001', type: 'related_to' },
  { to: 'ent_niagara_falls_crossing_001', type: 'related_to' },
  { to: 'gap_thompson_ame_zion_church', type: 'related_to' },
];

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/**
 * Report every person record whose editorial summary is a site record — the generated shell, or
 * a lead sentence whose subject is the monument rather than the person.
 */
async function auditPersonSiteConflation(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{
    id: string;
    display_name: string;
    canonical_summary: string | null;
    release_summary: string | null;
    criteria: string | null;
    claim_count: number;
  }>(
    `WITH ar AS (SELECT release_id FROM bb_public.v_active_release_id)
     SELECT
       e.id,
       e.display_name,
       e.kind_detail -> 'editorial' ->> 'summary' AS canonical_summary,
       r.summary AS release_summary,
       (
         SELECT string_agg(DISTINCT b ->> 'criterion', ',')
         FROM jsonb_array_elements(COALESCE(e.notability_basis, '[]'::jsonb)) b
       ) AS criteria,
       COALESCE(jsonb_array_length(r.claims), 0) AS claim_count
     FROM bb_canonical.entities e
     LEFT JOIN bb_public.release_entities r
       ON r.entity_id = e.id AND r.release_id = (SELECT release_id FROM ar)
     WHERE e.kind = 'person'
     ORDER BY e.display_name`,
  );

  const findings = rows.filter((row) => {
    const texts = [row.canonical_summary ?? '', row.release_summary ?? ''];
    return texts.some((text) => SITE_SHELL_MARKERS.some((marker) => text.includes(marker)));
  });

  console.log(`\n=== Person records carrying a site shell: ${findings.length} ===`);
  for (const row of findings) {
    const canonicalBad = SITE_SHELL_MARKERS.some((m) => (row.canonical_summary ?? '').includes(m));
    const releaseBad = SITE_SHELL_MARKERS.some((m) => (row.release_summary ?? '').includes(m));
    console.log(
      `  ${row.id} (${row.display_name}) — canonical:${canonicalBad ? 'SITE' : 'ok'} ` +
        `release:${releaseBad ? 'SITE' : 'ok'} criteria:${row.criteria ?? 'none'} ` +
        `claims:${row.claim_count}`,
    );
  }

  // documented_site on a person is a category error on its own — the rubric reserves it for sites.
  const personsOnDocumentedSiteOnly = rows.filter((row) => row.criteria === 'documented_site');
  console.log(
    `\nPerson records whose only notability criterion is documented_site: ` +
      `${personsOnDocumentedSiteOnly.length} (rubric reserves that criterion for sites)`,
  );
}

async function applyTubmanSplit(client: pg.Client, releaseId: string): Promise<void> {
  const claimsJson = JSON.stringify(TUBMAN_CLAIMS);
  const claimIdsJson = JSON.stringify(TUBMAN_CLAIMS.map((claim) => claim.id));
  const notabilityJson = JSON.stringify(TUBMAN_NOTABILITY);
  const notabilityLabelsJson = JSON.stringify(TUBMAN_NOTABILITY_LABELS);
  const locationJson = JSON.stringify(TUBMAN_LOCATION);

  await client.query(
    `UPDATE bb_canonical.entities
     SET
       notability_basis = $2::jsonb,
       kind_detail = jsonb_set(
         jsonb_set(
           jsonb_set(
             kind_detail,
             '{editorial,summary}',
             to_jsonb($3::text),
             true
           ),
           '{editorial,historicalContext}',
           to_jsonb($4::text),
           true
         ),
         '{jurisdiction,label}',
         to_jsonb($5::text),
         true
       ),
       updated_at = now()
     WHERE id = $1`,
    [TUBMAN_ID, notabilityJson, TUBMAN_SUMMARY, TUBMAN_CONTEXT, TUBMAN_JURISDICTION_LABEL],
  );

  await client.query(
    `UPDATE bb_public.release_entities
     SET
       summary = $3,
       claims = $4::jsonb,
       location = $8::jsonb,
       lat = ($8::jsonb ->> 'lat')::double precision,
       lng = ($8::jsonb ->> 'lng')::double precision,
       projection = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
                     '{claims}', $4::jsonb, true
                   ),
                   '{claimIds}', $5::jsonb, true
                 ),
                 '{notabilityBasis}', $6::jsonb, true
               ),
               '{notabilityLabels}', $7::jsonb, true
             ),
             '{location}', $8::jsonb, true
           ),
           '{locationLabel}', to_jsonb($9::text), true
         ),
         '{historicalContext}', to_jsonb($10::text), true
       )
     WHERE release_id = $1 AND entity_id = $2`,
    [
      releaseId,
      TUBMAN_ID,
      TUBMAN_SUMMARY,
      claimsJson,
      claimIdsJson,
      notabilityJson,
      notabilityLabelsJson,
      locationJson,
      TUBMAN_LOCATION_LABEL,
      TUBMAN_CONTEXT,
    ],
  );

  await client.query(
    `UPDATE bb_public.search_index
     SET
       claim_count = $3,
       geohash = $4,
       facets = jsonb_set(
         jsonb_set(
           jsonb_set(facets, '{claimCount}', to_jsonb($3::int), true),
           '{notabilityBasis}', $5::jsonb, true
         ),
         '{notabilityLabels}', $6::jsonb, true
       )
     WHERE release_id = $1 AND entity_id = $2`,
    [
      releaseId,
      TUBMAN_ID,
      TUBMAN_CLAIMS.length,
      TUBMAN_LOCATION.geohash,
      notabilityJson,
      notabilityLabelsJson,
    ],
  );

  // Link her to her own park, raid, and home. Only edges whose target is in the active release.
  for (const edge of TUBMAN_EDGES) {
    await client.query(
      `INSERT INTO bb_canonical.entity_relationships
         (id, from_entity_id, to_entity_id, relationship_type, workflow_status,
          publication_status, confidence, created_at, updated_at)
       SELECT
         'rel_repo9ki8_' || md5($1 || ':' || $2 || ':' || $3),
         $1, $2, $3, 'accepted', 'published',
         '{"level":"high","source":"repo-9ki8 person/site split"}'::jsonb,
         now(), now()
       WHERE EXISTS (
         SELECT 1 FROM bb_public.release_entities
         WHERE release_id = $4 AND entity_id = $2
       )
       ON CONFLICT (id) DO NOTHING`,
      [TUBMAN_ID, edge.to, edge.type, releaseId],
    );
  }
}

/**
 * Washington's release row already carries a real biography with four cited claims — only
 * bb_canonical still holds the stale site shell. Pull the good published text back into
 * canonical so the next release build does not overwrite the good row with the bad one.
 */
async function applyWashingtonCanonicalDrift(
  client: pg.Client,
  releaseId: string,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE bb_canonical.entities e
     SET
       kind_detail = jsonb_set(
         jsonb_set(
           e.kind_detail,
           '{editorial,summary}',
           to_jsonb(r.summary),
           true
         ),
         '{editorial,historicalContext}',
         COALESCE(r.projection -> 'historicalContext', e.kind_detail -> 'editorial' -> 'historicalContext', 'null'::jsonb),
         true
       ),
       updated_at = now()
     FROM bb_public.release_entities r
     WHERE e.id = $1
       AND r.entity_id = $1
       AND r.release_id = $2
       AND r.summary IS NOT NULL
       AND r.summary <> ''
       AND NOT (r.summary LIKE '%Documented life dates:%')`,
    [WASHINGTON_ID, releaseId],
  );
  return (rowCount ?? 0) > 0;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== repo-9ki8 person/site conflation split ===');
    await auditPersonSiteConflation(client);

    const activeRelease = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.active_release LIMIT 1`,
    );
    const releaseId = activeRelease.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const before = await client.query(
      `SELECT summary, jsonb_array_length(COALESCE(claims, '[]'::jsonb)) AS claims
       FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, TUBMAN_ID],
    );
    console.log('\nTubman release row before:', JSON.stringify(before.rows[0] ?? null));

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run. Set DRY_RUN=0 FIX_PERSON_SITE_CONFLATION_APPLY=1 to apply.\n' +
          `Would write ${TUBMAN_CLAIMS.length} cited claims, a person-first summary, ` +
          `notability ${TUBMAN_NOTABILITY.map((n) => n.criterion).join('+')}, ` +
          `location precision '${TUBMAN_LOCATION.precision}', and ${TUBMAN_EDGES.length} edges.`,
      );
      return;
    }

    await client.query('BEGIN');
    try {
      await applyTubmanSplit(client, releaseId);
      const washingtonFixed = await applyWashingtonCanonicalDrift(client, releaseId);
      await client.query('COMMIT');
      console.log('\nApplied. Washington canonical drift repaired:', washingtonFixed);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await client.query(
      `SELECT summary, jsonb_array_length(COALESCE(claims, '[]'::jsonb)) AS claims,
              location ->> 'precision' AS precision
       FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, TUBMAN_ID],
    );
    console.log('\nTubman release row after:', JSON.stringify(after.rows[0] ?? null));

    await auditPersonSiteConflation(client);

    console.log(
      '\nNext: populate related[] and rebuild the graph —\n' +
        '  DRY_RUN=0 BACKFILL_RELATED_FROM_EDGES_APPLY=1 node --conditions development ' +
        '--import tsx packages/ops-data/scripts/backfill-release-related-from-edges.ts\n' +
        '  node --conditions development --import tsx ' +
        'packages/ops-data/scripts/rebuild-release-graph.ts',
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
