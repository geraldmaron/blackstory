/**
 * Restores the movement_significance inclusion basis on two records whose published basis
 * recorded only how the person died.
 *
 * Ell Persons (lynching_ell_persons_memphis_tennessee): the NAACP investigation of his lynching
 * by James Weldon Johnson led to the chartering of the Memphis NAACP branch in June 1917. The
 * record already carried that fact as a claim, but with the agency inverted ("contributed to")
 * and cited to Wikipedia, and its wording matched no movement term, so the basis builder filed
 * it under documented_site and dropped it.
 *
 * Vernon Dahmer (ent_vernon_dahmer_001): Forrest County NAACP president who organized voter
 * registration and announced on the radio on January 9, 1966 that he would pay the poll tax for
 * anyone who could not afford it; the Klan firebombed his home that night. The record carried
 * the organizing as a claim that said "register to vote", two words short of the movement
 * vocabulary, so the basis builder dropped it the same way.
 *
 * What this writes, in one transaction per record: the claim rewritten in place (same id) with
 * the movement wording and a citation to the branch's own history or SNCC Digital Gateway;
 * projection.notabilityBasis and notabilityLabels set to the merge of the published records
 * with the recomputed movement_significance record (the existing documented_racial_terror
 * entries are kept exactly as published); the same basis on the canonical row, whose
 * movement_significance entry had no evidence; and the search-index facets for both fields.
 * Canonical claim text lives in bb_canonical.claim_versions and is versioned there; this script
 * reports whether a canonical claim row exists but leaves that history untouched.
 *
 * A straight recompute is deliberately not used: on the Persons record it would also promote
 * the interrogation and capture claims to inclusion reasons, which the published basis does not
 * carry. The merge rule mirrors apply-notability-rubric-ruling.ts.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 FIX_MOVEMENT_SIGNIFICANCE_APPLY=1
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/fix-movement-significance-basis.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_MOVEMENT_SIGNIFICANCE_APPLY === '1';

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

type BasisRecord = {
  readonly note: string;
  readonly criterion: string;
  readonly evidenceIds: readonly string[];
};

type Fix = {
  readonly entityId: string;
  readonly claim: ReleaseClaim;
  readonly movementBasis: BasisRecord;
};

const RACIAL_TERROR_LABEL =
  "The entity is a person killed in a documented act of racial terror — a lynching or other extrajudicial racial killing — or the event or place where such a killing is documented. The basis for inclusion is the killing and its documentation, never an accusation made against the person killed: the Equal Justice Initiative's Lynching in America research records that nearly every victim was killed without being legally convicted of any offense, and that such accusations were routinely fabricated and rarely investigated. The record names the person so the killing is not anonymous.";
const MOVEMENT_LABEL =
  'The entity (person, organization, event, place, or a movement-kind entity itself) played a documented, non-incidental role in a named movement (Civil Rights Movement, Great Migration, Black Power, Black Arts Movement, etc.) — organizing, leading, hosting, or being a recognized site or symbol of it.';

const FIXES: readonly Fix[] = [
  {
    entityId: 'lynching_ell_persons_memphis_tennessee',
    claim: {
      id: 'claim_lynching_ell_persons_memphis_tennessee_06',
      predicate: 'was followed by',
      object:
        'the NAACP investigation of his lynching by field secretary James Weldon Johnson and the chartering of a Memphis branch of the NAACP in June 1917 by Robert R. Church, Jr. and other community leaders, which gave the civil rights movement a standing organization in the city',
      claimRole: 'evidence',
      confidenceLevel: 'medium',
      citationSource: 'naacpmemphis.org',
      citationHref: 'https://naacpmemphis.org/history/',
      citationLabel:
        'NAACP Field Secretary, James Weldon Johnson came to Memphis to investigate the lynching of Ell Persons. Upon his arrival, he met with his friend Robert R. Church, Jr. and a charter for the National Association for the Advancement of Colored People Memphis Branch was developed.',
    },
    movementBasis: {
      note: 'Was followed by the NAACP investigation of his lynching by field secretary James Weldon Johnson and the chartering of a Memphis branch of the NAACP in June 1917 by Robert R. Church, Jr. and other community leaders, which gave the civil rights movement a standing organization in the city.',
      criterion: 'movement_significance',
      evidenceIds: ['claim_lynching_ell_persons_memphis_tennessee_06'],
    },
  },
  {
    entityId: 'ent_vernon_dahmer_001',
    claim: {
      id: 'claim_vernon_dahmer_001_01',
      predicate: 'organized',
      object:
        'voter registration in Hattiesburg, Mississippi as president of the Forrest County NAACP, and announced on the radio on January 9, 1966 that he would pay the poll tax for anyone who could not afford it',
      claimRole: 'evidence',
      confidenceLevel: 'medium',
      citationSource: 'snccdigital.org',
      citationHref: 'https://snccdigital.org/people/vernon-dahmer/',
      citationLabel:
        "He was an outspoken civil rights activist and the president of the Forrest County NAACP. On January 9, 1966, Dahmer announced on the radio that he would pay the poll tax for anyone who couldn't afford it.",
    },
    movementBasis: {
      note: 'Organized voter registration in Hattiesburg, Mississippi as president of the Forrest County NAACP, and announced on the radio on January 9, 1966 that he would pay the poll tax for anyone who could not afford it.',
      criterion: 'movement_significance',
      evidenceIds: ['claim_vernon_dahmer_001_01'],
    },
  },
];

function connectionString(): string {
  const value = process.env.DATABASE_URL?.trim() ?? process.env.APP_DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL or APP_DATABASE_URL is required');
  return value;
}

/** Published records other than documented_site survive; the movement record is added once. */
function mergeBasis(published: readonly BasisRecord[], movement: BasisRecord): BasisRecord[] {
  const kept = published.filter(
    (entry) => entry.criterion !== 'documented_site' && entry.criterion !== movement.criterion,
  );
  return [...kept, movement];
}

function labelsFor(basis: readonly BasisRecord[]): string[] {
  const labels: string[] = [];
  for (const entry of basis) {
    const label =
      entry.criterion === 'documented_racial_terror'
        ? RACIAL_TERROR_LABEL
        : entry.criterion === 'movement_significance'
          ? MOVEMENT_LABEL
          : undefined;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

async function main(): Promise<void> {
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
    for (const fix of FIXES) {
      const live = await client.query<{
        claims: readonly ReleaseClaim[] | null;
        basis: readonly BasisRecord[] | null;
        labels: readonly string[] | null;
      }>(
        `SELECT claims, projection->'notabilityBasis' AS basis, projection->'notabilityLabels' AS labels
         FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, fix.entityId],
      );
      const row = live.rows[0];
      if (!row) throw new Error(`${fix.entityId}: not in the active release`);
      const currentClaims = row.claims ?? [];
      const target = currentClaims.find((claim) => claim.id === fix.claim.id);
      if (!target) throw new Error(`${fix.entityId}: claim ${fix.claim.id} not found`);
      const nextClaims = currentClaims.map((claim) =>
        claim.id === fix.claim.id ? fix.claim : claim,
      );
      const publishedBasis = row.basis ?? [];
      const nextBasis = mergeBasis(publishedBasis, fix.movementBasis);
      const nextLabels = labelsFor(nextBasis);
      const unlabeled = nextBasis.filter(
        (entry) =>
          entry.criterion !== 'documented_racial_terror' &&
          entry.criterion !== 'movement_significance',
      );
      if (unlabeled.length > 0) {
        throw new Error(
          `${fix.entityId}: published basis carries criteria this script has no label for: ${unlabeled
            .map((entry) => entry.criterion)
            .join(', ')}`,
        );
      }
      const canonicalClaimRows = await client.query<{ n: string }>(
        'SELECT count(*) AS n FROM bb_canonical.claims WHERE id = $1',
        [fix.claim.id],
      );

      console.log(`\n== ${fix.entityId}`);
      console.log(
        `  claim ${fix.claim.id}: "${target.predicate} ${target.object.slice(0, 60)}..." (${target.citationSource})`,
      );
      console.log(
        `    -> "${fix.claim.predicate} ${fix.claim.object.slice(0, 60)}..." (${fix.claim.citationSource})`,
      );
      console.log(
        `  basis: ${publishedBasis.map((entry) => entry.criterion).join(', ')} -> ${nextBasis.map((entry) => entry.criterion).join(', ')}`,
      );
      console.log(`  labels: ${(row.labels ?? []).length} -> ${nextLabels.length}`);
      console.log(
        `  bb_canonical.claims rows for this claim id: ${canonicalClaimRows.rows[0]?.n ?? '0'}`,
      );

      if (DRY_RUN || !APPLY) continue;

      await client.query('BEGIN');
      await client.query(
        `UPDATE bb_public.release_entities
         SET claims = $3::jsonb,
             projection = jsonb_set(
               jsonb_set(
                 jsonb_set(projection, '{claims}', $3::jsonb, true),
                 '{notabilityBasis}', $4::jsonb, true
               ),
               '{notabilityLabels}', $5::jsonb, true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [
          releaseId,
          fix.entityId,
          JSON.stringify(nextClaims),
          JSON.stringify(nextBasis),
          JSON.stringify(nextLabels),
        ],
      );
      await client.query(
        `UPDATE bb_public.search_index
         SET facets = jsonb_set(
               jsonb_set(COALESCE(facets, '{}'::jsonb), '{notabilityBasis}', $3::jsonb, true),
               '{notabilityLabels}', $4::jsonb, true
             )
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, fix.entityId, JSON.stringify(nextBasis), JSON.stringify(nextLabels)],
      );
      await client.query(
        `UPDATE bb_canonical.entities SET notability_basis = $2::jsonb, updated_at = now() WHERE id = $1`,
        [fix.entityId, JSON.stringify(nextBasis)],
      );
      await client.query('COMMIT');
      written += 1;
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 FIX_MOVEMENT_SIGNIFICANCE_APPLY=1 to apply.',
      );
      return;
    }
    console.log(`\nApplied: ${written} record(s).`);
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
