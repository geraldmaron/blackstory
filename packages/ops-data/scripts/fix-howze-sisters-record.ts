/**
 * Corrects the two Howze sisters records (Shubuta, Mississippi, 1918).
 *
 * The published summaries described the sexual exploitation of a sixteen-year-old and her
 * sister by their married white employer as "a complex personal conflict involving interracial
 * relationships and pregnancy", and never said that no trial happened. The second claim on each
 * record reproduced the mob's accusation ("alleged murder of a dentist") as the record's own
 * statement, and on Alma's canonical row that accusation still stood as a notability basis.
 *
 * What this writes, in one transaction per record:
 *   - canonical kind_detail.editorial.summary and historicalContext: the corrected prose, drafted
 *     from the JMU Memorializing Racial Terror marker record and validated against the enrichment
 *     harness's own summary validator (400 to 900 characters, no address-precision locator).
 *   - canonical notability_basis: every entry whose note states the accusation is removed.
 *   - the live release row: summary, projection.summary, projection.historicalContext, and the
 *     claims. The accusation claim is replaced by a claim that the four were seized from the jail
 *     and killed before any trial, and a claim carrying the documented exploitation is added; both
 *     cite the JMU record. projection.claimIds and search_index.claim_count follow.
 *
 * These are curated seed records with no landscape row and no captured evidence, so the ledger
 * path (session-enrich-apply, the incremental publisher) cannot reach them; this is the same
 * direct-write shape fix-person-notability-and-stubs.ts uses for that population.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 FIX_HOWZE_SISTERS_APPLY=1
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/fix-howze-sisters-record.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_HOWZE_SISTERS_APPLY === '1';

const JMU_HREF = 'https://sites.lib.jmu.edu/lynchingmarkers/ms1918122001/';
const JMU_LABEL = 'JMU Memorializing Racial Terror: Shubuta, Mississippi, December 20, 1918';
const JMU_SOURCE = 'sites.lib.jmu.edu';

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

type Correction = {
  readonly entityId: string;
  readonly summary: string;
  readonly historicalContext: string;
  /** The claim the mob's accusation used to occupy, rewritten to what the record documents. */
  readonly trialClaim: Omit<ReleaseClaim, 'id'>;
  readonly exploitationClaim: Omit<ReleaseClaim, 'id'>;
};

const SHARED_HISTORICAL_CONTEXT =
  'The Howze sisters were two of six Black victims killed at the nearby "Hanging Bridge" during the first half of the twentieth century; twenty-four years later a mob hanged two teenaged boys, Ernest Green and Charlie Lang, at the same bridge. The 1918 Hanging Bridge killings figured prominently in the NAACP’s landmark report, Thirty Years of Lynching, released in 1919, and these killings and the investigations that followed connected this rural community to a national civil rights struggle. The Howze sisters’ fate reflected the enormous risks faced by Black Mississippians and particularly Black women, who were deemed a threat to white control.';

function claimsFor(
  sister: 'Alma' | 'Maggie',
): Pick<Correction, 'trialClaim' | 'exploitationClaim'> {
  return {
    trialClaim: {
      predicate: 'was killed before any trial',
      object:
        'a mob seized the four suspects, all in their late teens and early twenties, from the Shubuta jail and hanged them from a local river bridge',
      claimRole: 'evidence',
      citationHref: JMU_HREF,
      citationLabel: JMU_LABEL,
      citationSource: JMU_SOURCE,
      confidenceLevel: 'medium',
    },
    exploitationClaim: {
      predicate: 'is documented as',
      object: `one of the two Howze sisters whom, multiple sources alleged, the murdered employer had sexually exploited; both women were pregnant at the time of their deaths (${sister} among them)`,
      claimRole: 'evidence',
      citationHref: JMU_HREF,
      citationLabel: JMU_LABEL,
      citationSource: JMU_SOURCE,
      confidenceLevel: 'medium',
    },
  };
}

const CORRECTIONS: readonly Correction[] = [
  {
    entityId: 'lynching_alma_howze_shubuta_hanging_bridge_mississippi',
    summary:
      'Alma Howze was one of four young Black Mississippians lynched near Shubuta, Mississippi, on December 20, 1918. Just before Christmas, local authorities charged her, her sister Maggie Howze, and brothers Major and Andrew Clark in the murder of their white employer. The four, all in their late teens and early twenties, were killed before any trial: a mob seized them from the Shubuta jail and hanged them from a river bridge. White residents alleged a conspiracy over a wage dispute, but multiple sources alleged that the murdered employer had sexually exploited the Howze sisters and that both women, Alma among them, were pregnant at the time of their deaths. Their killings accelerated a national NAACP anti-lynching campaign.',
    historicalContext: SHARED_HISTORICAL_CONTEXT,
    ...claimsFor('Alma'),
  },
  {
    entityId: 'lynching_maggie_howze_shubuta_hanging_bridge_mississippi',
    summary:
      'Maggie Howze was one of four young Black Mississippians lynched near Shubuta, Mississippi, on December 20, 1918, with her sister Alma Howze and brothers Major and Andrew Clark. Just before Christmas, local authorities charged the four in the murder of their white employer. All were in their late teens and early twenties, and all were killed before any trial: a mob seized them from the Shubuta jail and hanged them from a river bridge. White residents alleged a conspiracy over a wage dispute, but multiple sources alleged that the murdered employer had sexually exploited the Howze sisters and that both women, Maggie among them, were pregnant at the time of their deaths. Their killings accelerated a national NAACP anti-lynching campaign underscoring the threats of racial violence to Black women and children.',
    historicalContext: SHARED_HISTORICAL_CONTEXT,
    ...claimsFor('Maggie'),
  },
];

function statesAccusation(text: unknown): boolean {
  return typeof text === 'string' && /\b(accused|alleged murder)\b/iu.test(text);
}

function connectionString(): string {
  const value = process.env.DATABASE_URL?.trim() ?? process.env.APP_DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL or APP_DATABASE_URL is required');
  return value;
}

async function main(): Promise<void> {
  for (const correction of CORRECTIONS) {
    const length = correction.summary.length;
    if (length < 400 || length > 900) {
      throw new Error(
        `${correction.entityId}: summary is ${length} characters, outside 400 to 900`,
      );
    }
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

    let written = 0;
    for (const correction of CORRECTIONS) {
      const canonical = await client.query<{
        notability_basis: readonly { readonly note?: string }[] | null;
      }>('SELECT notability_basis FROM bb_canonical.entities WHERE id = $1', [correction.entityId]);
      const live = await client.query<{ claims: readonly ReleaseClaim[] | null; summary: string }>(
        'SELECT claims, summary FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2',
        [releaseId, correction.entityId],
      );
      const canonicalRow = canonical.rows[0];
      const liveRow = live.rows[0];
      if (!canonicalRow || !liveRow) {
        throw new Error(`${correction.entityId}: missing canonical or live row`);
      }

      const currentBasis = canonicalRow.notability_basis ?? [];
      const keptBasis = currentBasis.filter((entry) => !statesAccusation(entry.note));
      const currentClaims = liveRow.claims ?? [];
      const accusationClaims = currentClaims.filter(
        (claim) => statesAccusation(claim.predicate) || statesAccusation(claim.object),
      );
      if (accusationClaims.length !== 1) {
        throw new Error(
          `${correction.entityId}: expected exactly one accusation claim, found ${accusationClaims.length}`,
        );
      }
      const accusationClaim = accusationClaims[0]!;
      const nextClaims: ReleaseClaim[] = currentClaims.map((claim) =>
        claim.id === accusationClaim.id ? { id: claim.id, ...correction.trialClaim } : claim,
      );
      const suffix = String(currentClaims.length + 1).padStart(2, '0');
      nextClaims.push({
        id: `claim_${correction.entityId}_${suffix}`,
        ...correction.exploitationClaim,
      });
      const claimIds = nextClaims.map((claim) => claim.id);

      console.log(`\n== ${correction.entityId}`);
      console.log(
        `  live summary (${liveRow.summary.length} chars) -> ${correction.summary.length} chars`,
      );
      console.log(
        `  canonical notability_basis: ${currentBasis.length} entries -> ${keptBasis.length} (accusation entries removed: ${currentBasis.length - keptBasis.length})`,
      );
      console.log(
        `  claim ${accusationClaim.id} rewritten: "${accusationClaim.predicate} ${accusationClaim.object}" -> "${correction.trialClaim.predicate}"`,
      );
      console.log(`  claim added: ${claimIds[claimIds.length - 1]} (${JMU_SOURCE})`);

      if (DRY_RUN || !APPLY) continue;

      await client.query('BEGIN');
      await client.query(
        `UPDATE bb_canonical.entities
         SET kind_detail = jsonb_set(
               jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
               '{editorial,historicalContext}', to_jsonb($3::text), true
             ),
             notability_basis = $4::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [
          correction.entityId,
          correction.summary,
          correction.historicalContext,
          JSON.stringify(keptBasis),
        ],
      );
      await client.query(
        `UPDATE bb_public.release_entities
         SET summary = $3,
             claims = $4::jsonb,
             projection = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
                   '{historicalContext}', to_jsonb($5::text), true
                 ),
                 '{claims}', $4::jsonb, true
               ),
               '{claimIds}', $6::jsonb, true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [
          releaseId,
          correction.entityId,
          correction.summary,
          JSON.stringify(nextClaims),
          correction.historicalContext,
          JSON.stringify(claimIds),
        ],
      );
      await client.query(
        `UPDATE bb_public.search_index
         SET claim_count = $3,
             facets = jsonb_set(facets, '{claimCount}', to_jsonb($3::int), true)
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, correction.entityId, nextClaims.length],
      );
      await client.query('COMMIT');
      written += 1;
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 FIX_HOWZE_SISTERS_APPLY=1 to apply.',
      );
      return;
    }
    console.log(`\nApplied: ${written} record(s) corrected.`);
    remindToRepublishCatalogArtifacts(written);
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
