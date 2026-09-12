/**
 * Removes a mob's accusation from the text of three records where it sat in a claim OBJECT or a
 * historical context, out of reach of the predicate guard (isAccusationPredicate in
 * packages/domain/src/publication/release-builder.ts).
 *
 * Each record keeps the killing and states the absence of a trial, never the charge:
 *   - Persons, Ell, Lynching Site (nrhp-black-heritage-100009136): the source quote that becomes
 *     the record's own "source states" claim reproduced the rape accusation in detail. The quote
 *     is authored on the landscape row (payload.evidenceCitations[0].quote) and mirrored in the
 *     enrichment ledger draft; both are replaced with three verbatim passages from the same cited
 *     document that carry the arrest, the seizure before trial, and that no one was charged. The
 *     incremental publisher rebuilds the live claim from the landscape row on republish.
 *   - Harrison, Arkansas (sundown_harrison_arkansas): projection.historicalContext still named
 *     "a 1909 rape accusation against Charles Stinnett". The text is authored in the enrichment
 *     ledger draft and the landscape payload (historicalContext and provenance notes); all copies
 *     are replaced with the two expulsions as the Encyclopedia of Arkansas documents them.
 *   - Demon Lowman (lynching_demon_lowman_aiken_vicinity_south_carolina): a curated seed record
 *     with no landscape row, so the live row is written directly, the same shape
 *     fix-howze-sisters-record.ts uses. Two claims are rewritten (the jail seizure after a
 *     directed verdict of not guilty; the grand jury that refused to indict), one claim is re-cited
 *     to a document that supports it, and the summary no longer repeats the charge.
 *
 * Crescent Springs, Kentucky is deliberately not touched: its only claim is an allegation, the
 * basis builder returns nothing for it, and it is absent from the Tougaloo sundown-towns
 * database, so the honest outcome is a withdrawal decision, not a rewrite.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 FIX_ACCUSATION_OBJECTS_APPLY=1
 *
 * After apply, republish the two landscape-sourced records:
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-entities-incremental.ts \
 *     --ids=nrhp-black-heritage-100009136,sundown_harrison_arkansas --republish
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/fix-accusation-claim-objects.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_ACCUSATION_OBJECTS_APPLY === '1';

const ELL_PERSONS_SITE = 'nrhp-black-heritage-100009136';
const ELL_PERSONS_QUOTE =
  'Ell Persons was a black man who was lynched on 22 May 1917 … He was arrested and was awaiting trial when he was captured by a lynch party, who burned him alive … No one was charged as a result of the lynching';

const HARRISON = 'sundown_harrison_arkansas';
const HARRISON_CONTEXT =
  "Boone County seat Harrison's Black community was destroyed in two early-twentieth-century expulsions. A white mob stormed the jail in October 1905 and drove Black residents out of town. In January 1909 the arrest, trial and execution of Charles Stinnett drew a second mob; most of those who remained left on the night of January 28, 1909, and only one Black resident, Alecta Caledonia Melvina Smith, stayed. Later memorialization on the town square names the victims; the archival record keeps the designation as documented exclusion history.";
const HARRISON_NOTES =
  "Two documented riots, in 1905 and 1909, drove nearly the entire Black community out of Harrison; the 1905 mob whipped and burned out Black residents after a jailed man was seized from custody, and the second mob in January 1909 completed the town's transformation into an all-white community that persisted for decades.";

const LOWMAN = 'lynching_demon_lowman_aiken_vicinity_south_carolina';
const LOWMAN_SUMMARY =
  'Demon Lowman was lynched near Aiken, South Carolina, before dawn on October 8, 1926. A judge had directed a verdict of not guilty for him the previous day, and he was returned to the Aiken County jail rather than released. Hours later a white mob took him, his sister Bertha and his cousin Clarence from their cells and shot all three outside town, with a large crowd in attendance. An all-white Aiken County grand jury refused to indict anyone for the killings.';

type ReleaseClaim = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly claimRole: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly citationSource: string;
  readonly confidenceLevel: string;
};

const SC_PUBLIC_RADIO = {
  citationHref: 'https://www.southcarolinapublicradio.org/post/l-lowman-lynchings',
  citationSource: 'southcarolinapublicradio.org',
  citationLabel: 'South Carolina Public Radio, "\'L\' is for Lowman Lynchings"',
} as const;

const LOWMAN_CLAIM_CHANGES: Readonly<Record<string, Partial<ReleaseClaim>>> = {
  [`claim_${LOWMAN}_01`]: { ...SC_PUBLIC_RADIO, confidenceLevel: 'medium' },
  [`claim_${LOWMAN}_02`]: {
    predicate: 'was taken from the Aiken County jail',
    object:
      'before dawn on October 8, 1926, with his sister Bertha and his cousin Clarence, hours after a judge directed a verdict of not guilty for him and he was returned to the cell instead of released',
    citationHref: 'https://eji.org/news/the-george-stinney-tragedy/',
    citationSource: 'eji.org',
    citationLabel: 'Equal Justice Initiative, "The George Stinney Tragedy"',
    confidenceLevel: 'high',
  },
  [`claim_${LOWMAN}_04`]: {
    predicate: 'was never prosecuted',
    object: 'an all-white Aiken County grand jury refused to indict anyone for the killings',
    ...SC_PUBLIC_RADIO,
    confidenceLevel: 'medium',
  },
};

function statesAccusation(text: string | null | undefined): boolean {
  return typeof text === 'string' && /\b(accus|alleged|raped)/iu.test(text);
}

function connectionString(): string {
  const value = process.env.DATABASE_URL?.trim() ?? process.env.APP_DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL or APP_DATABASE_URL is required');
  return value;
}

async function main(): Promise<void> {
  if (LOWMAN_SUMMARY.length < 400 || LOWMAN_SUMMARY.length > 900) {
    throw new Error(`Lowman summary is ${LOWMAN_SUMMARY.length} characters, outside 400 to 900`);
  }
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const releaseId = (
      await client.query<{ release_id: string }>(
        'SELECT release_id FROM bb_public.v_active_release_id',
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const ell = await client.query<{ quote: string | null; draft_quote: string | null }>(
      `SELECT lc.payload->'evidenceCitations'->0->>'quote' AS quote,
              ee.notes->'draft'->'summaryCitations'->0->>'quote' AS draft_quote
       FROM bb_research.landscape_candidates lc
       LEFT JOIN bb_research.entity_enrichment ee ON ee.entity_id = lc.id
       WHERE lc.id = $1`,
      [ELL_PERSONS_SITE],
    );
    const ellRow = ell.rows[0];
    if (!ellRow) throw new Error(`${ELL_PERSONS_SITE}: no landscape row`);
    console.log(`\n== ${ELL_PERSONS_SITE}`);
    console.log(`  landscape quote states accusation: ${statesAccusation(ellRow.quote)}`);
    console.log(`  ledger draft quote states accusation: ${statesAccusation(ellRow.draft_quote)}`);

    const harrison = await client.query<{
      context: string | null;
      draft_context: string | null;
      notes: string | null;
    }>(
      `SELECT lc.payload->>'historicalContext' AS context,
              ee.notes->'draft'->>'historicalContext' AS draft_context,
              lc.payload->'provenance'->>'notes' AS notes
       FROM bb_research.landscape_candidates lc
       LEFT JOIN bb_research.entity_enrichment ee ON ee.entity_id = lc.id
       WHERE lc.id = $1`,
      [HARRISON],
    );
    const harrisonRow = harrison.rows[0];
    if (!harrisonRow) throw new Error(`${HARRISON}: no landscape row`);
    console.log(`\n== ${HARRISON}`);
    console.log(
      `  landscape historicalContext states accusation: ${statesAccusation(harrisonRow.context)}`,
    );
    console.log(
      `  ledger draft historicalContext states accusation: ${statesAccusation(harrisonRow.draft_context)}`,
    );
    console.log(`  provenance notes state accusation: ${statesAccusation(harrisonRow.notes)}`);

    const lowman = await client.query<{ claims: readonly ReleaseClaim[] | null; summary: string }>(
      'SELECT claims, summary FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2',
      [releaseId, LOWMAN],
    );
    const lowmanRow = lowman.rows[0];
    if (!lowmanRow) throw new Error(`${LOWMAN}: not in the active release`);
    const lowmanClaims = lowmanRow.claims ?? [];
    for (const id of Object.keys(LOWMAN_CLAIM_CHANGES)) {
      if (!lowmanClaims.some((claim) => claim.id === id)) {
        throw new Error(`${LOWMAN}: claim ${id} not found`);
      }
    }
    const nextLowmanClaims = lowmanClaims.map((claim) => ({
      ...claim,
      ...(LOWMAN_CLAIM_CHANGES[claim.id] ?? {}),
    }));
    console.log(`\n== ${LOWMAN}`);
    console.log(
      `  summary states accusation: ${statesAccusation(lowmanRow.summary)} (${lowmanRow.summary.length} chars -> ${LOWMAN_SUMMARY.length})`,
    );
    for (const claim of nextLowmanClaims) {
      const before = lowmanClaims.find((entry) => entry.id === claim.id)!;
      const changed = JSON.stringify(before) !== JSON.stringify(claim);
      console.log(
        `  ${claim.id}: ${changed ? 'rewritten' : 'unchanged'}${statesAccusation(claim.object) ? ' STILL STATES ACCUSATION' : ''}`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 FIX_ACCUSATION_OBJECTS_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE bb_research.landscape_candidates
       SET payload = jsonb_set(payload, '{evidenceCitations,0,quote}', to_jsonb($2::text), true),
           updated_at = now()
       WHERE id = $1`,
      [ELL_PERSONS_SITE, ELL_PERSONS_QUOTE],
    );
    await client.query(
      `UPDATE bb_research.entity_enrichment
       SET notes = jsonb_set(notes, '{draft,summaryCitations,0,quote}', to_jsonb($2::text), true),
           updated_at = now()
       WHERE entity_id = $1 AND notes->'draft'->'summaryCitations'->0 IS NOT NULL`,
      [ELL_PERSONS_SITE, ELL_PERSONS_QUOTE],
    );
    await client.query(
      `UPDATE bb_research.entity_enrichment
       SET notes = jsonb_set(notes, '{draft,historicalContext}', to_jsonb($2::text), true),
           updated_at = now()
       WHERE entity_id = $1 AND notes->'draft' IS NOT NULL`,
      [HARRISON, HARRISON_CONTEXT],
    );
    await client.query(
      `UPDATE bb_research.landscape_candidates
       SET payload = jsonb_set(
             jsonb_set(payload, '{historicalContext}', to_jsonb($2::text), true),
             '{provenance,notes}', to_jsonb($3::text), true
           ),
           provenance = CASE WHEN provenance ? 'notes'
             THEN jsonb_set(provenance, '{notes}', to_jsonb($3::text), true) ELSE provenance END,
           updated_at = now()
       WHERE id = $1`,
      [HARRISON, HARRISON_CONTEXT, HARRISON_NOTES],
    );
    await client.query(
      `UPDATE bb_public.release_entities
       SET summary = $3,
           claims = $4::jsonb,
           projection = jsonb_set(
             jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
             '{claims}', $4::jsonb, true
           )
       WHERE release_id = $1 AND entity_id = $2`,
      [releaseId, LOWMAN, LOWMAN_SUMMARY, JSON.stringify(nextLowmanClaims)],
    );
    await client.query(
      `UPDATE bb_canonical.entities
       SET kind_detail = jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
           updated_at = now()
       WHERE id = $1 AND kind_detail ? 'editorial'`,
      [LOWMAN, LOWMAN_SUMMARY],
    );
    await client.query('COMMIT');
    console.log('\nApplied: Ell Persons site quote, Harrison context, Lowman claims and summary.');
    console.log(
      'Now republish the two landscape-sourced records (see the header) so the live claim and context rebuild.',
    );
    remindToRepublishCatalogArtifacts(1);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // nothing to roll back outside a transaction
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
