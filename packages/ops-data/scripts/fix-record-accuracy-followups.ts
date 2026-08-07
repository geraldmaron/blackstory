/**
 * Accuracy corrections surfaced while fixing repo-9ki8 / repo-z1uk / repo-x8j6.
 *
 * 1. negro-leagues-hof-wilkinson-jl — J.L. Wilkinson was white. He sits in a Black history
 *    catalog alongside Black players with nothing saying so, which leaves a reader to assume
 *    otherwise. The fix is not to remove him: he founded and ran the Kansas City Monarchs for
 *    28 years and the record belongs. The fix is to say what the sources say, including that
 *    Rube Foster hesitated to admit a white-owned club to the Negro National League. That
 *    hesitation is the historically interesting part, and it disappears if the record is silent.
 *
 * 2. recon_h_e_hayne — display name was the initialism "H. E. Hayne"; the National Park Service
 *    gives it as Henry Hayne. (This record also has a duplicate, recon_harry_e_hayne — that
 *    merge is repo-jnpk and deliberately NOT done here, because merging belongs on the admin
 *    console's reversible applyEntityMerge path, not in a third hand-rolled implementation. See
 *    repo-iypc for why the existing ops merge script must not be used.)
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-record-accuracy-followups.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_RECORD_ACCURACY_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-record-accuracy-followups.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_RECORD_ACCURACY_APPLY === '1';

const WILKINSON_ID = 'negro-leagues-hof-wilkinson-jl';
const HAYNE_SURVIVOR_ID = 'recon_h_e_hayne';

const SABR_WILKINSON = 'https://sabr.org/bioproj/person/j-l-wilkinson/';

/**
 * Stated as the sources state it. SABR does not call him "the only white owner" — a claim that
 * circulates widely — so this does not either.
 */
const WILKINSON_CLAIM = {
  predicate: 'was_white_owner_admitted_to_negro_national_league',
  object:
    'Wilkinson was white. Negro National League founder Rube Foster was at first reluctant to accept white ownership of a club in his circuit and relented because of Wilkinson’s reputation for integrity and fairness.',
  citationHref: SABR_WILKINSON,
  citationLabel: 'Society for American Baseball Research BioProject: J.L. Wilkinson',
  citationSource: 'sabr.org',
  confidenceLevel: 'high',
};

const WILKINSON_SUMMARY_SENTENCE =
  ' Wilkinson was white; Negro National League founder Rube Foster was at first reluctant to admit a white-owned club and relented on Wilkinson’s reputation.';

const HAYNE_DISPLAY_NAME = 'Henry E. Hayne';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
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

    console.log('=== record accuracy follow-ups ===');

    const wilkinson = await client.query<{ summary: string; claims: { predicate: string }[] }>(
      `SELECT summary, COALESCE(claims, '[]'::jsonb) AS claims
       FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, WILKINSON_ID],
    );
    const wilkinsonRow = wilkinson.rows[0];
    if (!wilkinsonRow) throw new Error(`${WILKINSON_ID} not found in the active release`);

    const alreadyStated = wilkinsonRow.claims.some(
      (claim) => claim.predicate === WILKINSON_CLAIM.predicate,
    );
    console.log(`\nWilkinson: race already stated in the record? ${alreadyStated}`);
    console.log(`  summary now: ${wilkinsonRow.summary.slice(0, 120)}…`);

    const hayne = await client.query<{ display_name: string }>(
      `SELECT display_name FROM bb_canonical.entities WHERE id = $1`,
      [HAYNE_SURVIVOR_ID],
    );
    console.log(
      `\nHayne survivor display name: "${hayne.rows[0]?.display_name}" -> "${HAYNE_DISPLAY_NAME}"`,
    );

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run. Set DRY_RUN=0 FIX_RECORD_ACCURACY_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      if (!alreadyStated) {
        const claimId = `claim_${WILKINSON_ID.replace(/-/g, '_')}_${String(
          wilkinsonRow.claims.length + 1,
        ).padStart(2, '0')}`;
        const claim = { id: claimId, ...WILKINSON_CLAIM };
        const summary = `${wilkinsonRow.summary.trimEnd()}${WILKINSON_SUMMARY_SENTENCE}`;

        await client.query(
          `UPDATE bb_public.release_entities
           SET summary = $3,
               claims = COALESCE(claims, '[]'::jsonb) || $4::jsonb,
               projection = jsonb_set(
                 jsonb_set(
                   jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
                   '{claims}', COALESCE(projection -> 'claims', '[]'::jsonb) || $4::jsonb, true
                 ),
                 '{claimIds}', COALESCE(projection -> 'claimIds', '[]'::jsonb) || $5::jsonb, true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, WILKINSON_ID, summary, JSON.stringify([claim]), JSON.stringify([claimId])],
        );
        await client.query(
          `UPDATE bb_canonical.entities
           SET kind_detail = jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
               updated_at = now()
           WHERE id = $1`,
          [WILKINSON_ID, summary],
        );
        await client.query(
          `UPDATE bb_public.search_index
           SET claim_count = claim_count + 1,
               facets = jsonb_set(facets, '{claimCount}', to_jsonb(claim_count + 1), true)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, WILKINSON_ID],
        );
      }

      await client.query(
        `UPDATE bb_canonical.entities SET display_name = $2, updated_at = now() WHERE id = $1`,
        [HAYNE_SURVIVOR_ID, HAYNE_DISPLAY_NAME],
      );
      await client.query(
        `UPDATE bb_public.release_entities
         SET display_name = $3,
             projection = jsonb_set(
               jsonb_set(projection, '{displayName}', to_jsonb($3::text), true),
               '{nameLower}', to_jsonb(lower($3::text)), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, HAYNE_SURVIVOR_ID, HAYNE_DISPLAY_NAME],
      );
      await client.query(
        `UPDATE bb_public.search_index
         SET name = $3, name_lower = lower($3),
             facets = jsonb_set(
               jsonb_set(facets, '{displayName}', to_jsonb($3::text), true),
               '{nameLower}', to_jsonb(lower($3::text)), true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, HAYNE_SURVIVOR_ID, HAYNE_DISPLAY_NAME],
      );

      await client.query('COMMIT');
      console.log('\nApplied.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await client.query(
      `SELECT summary, jsonb_array_length(claims) AS claims
       FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, WILKINSON_ID],
    );
    console.log('\nWilkinson after:', JSON.stringify(after.rows[0]));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
