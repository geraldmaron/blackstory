/**
 * repo-00gxb — adds the one claim each of two records is missing: that its subject was killed.
 *
 * Both records are ABOUT a killing and neither says so in a claim, which is why the racial-terror
 * matcher (repo-90g0i) could not reach them honestly. The matcher was deliberately not widened to
 * cover them: inferring a killing from summary prose is what nearly filed Ida B. Wells as a victim
 * of the lynchings she reported. The defect is in the records, so it is fixed in the records.
 *
 * Neither claim introduces a new source. Both promote a fact the record ALREADY carries in a
 * citation it already holds, into the claim where a reader and the basis builder can see it:
 *
 *   Sharonda Coleman-Singleton — one of the Emanuel Nine. Her claims say `killed | Sharonda
 *   Coleman-Singleton`, `member of`, `killed during | Bible study`, `killed on`, `listed as |
 *   Emanuel Nine`. Nothing names the attack as racial. The other eight records carry exactly the
 *   claim added here, from the same cited page. Verified 2026-09-09: that page names her among the
 *   nine killed and records the attacker's white-supremacist motive.
 *
 *   Emmett Till (the PERSON record; the event record gap_emmett_till_lynching is already correct).
 *   His claims are `was found` and `was recovered | near Graball Landing on the Tallahatchie
 *   River`. Nothing says he was lynched — so a 14-year-old who was abducted, tortured and lynched
 *   publishes under `movement_significance`, "played a documented, non-incidental role in a named
 *   movement". His record already cites the National Park Service's Graball Landing page at
 *   confidence `high`, whose text reads "Fourteen-year-old Emmett Till's body was found near
 *   Graball Landing on the Tallahatchie River following his lynching in 1955." The lynching is
 *   already sourced on this record. It is simply not in a claim.
 *
 * Neither record has a `bb_research.landscape_candidates` row, so there is no upstream row that
 * would overwrite these on a republish.
 *
 * Idempotent: a claim already carrying the same predicate and object is left alone. The record's
 * `notabilityBasis` is recomputed afterwards by `buildReleaseNotabilityBasis` on the new claim set,
 * so this script holds no second copy of the inference.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-missing-killing-claims.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_MISSING_KILLING_CLAIMS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-missing-killing-claims.ts
 */
import pg from 'pg';
import {
  buildReleaseNotabilityBasis,
  NOTABILITY_RUBRIC,
  type NotabilityBasisRecord,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_MISSING_KILLING_CLAIMS_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** One claim to add, written to match the shape the record's existing claims already use. */
type ClaimAddition = {
  readonly entityId: string;
  readonly predicate: string;
  readonly object: string;
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly confidenceLevel: 'low' | 'medium' | 'high';
  /**
   * When set, the claim carrying this predicate and this exact object is REWRITTEN rather than a
   * second claim appended beside it. Sharonda Coleman-Singleton's record holds `killed | Sharonda
   * Coleman-Singleton` — a claim whose object is her own name, so it says nothing and renders as
   * "Killed." Appending a better `killed` claim would not help: the basis builder groups by
   * predicate and reads the first claim's object, so the new sentence would never surface. The
   * empty claim is replaced by the sourced one instead of kept alongside it.
   */
  readonly replacesObject?: string;
};

const ADDITIONS: readonly ClaimAddition[] = [
  {
    entityId: 'ent_sharonda_coleman_singleton_001',
    predicate: 'killed',
    object: 'during the white-supremacist massacre at Emanuel African Methodist Episcopal Church',
    citationSource: 'en.wikipedia.org',
    citationHref: 'https://en.wikipedia.org/wiki/Charleston_church_shooting',
    citationLabel: 'Charleston church shooting',
    confidenceLevel: 'low',
    replacesObject: 'Sharonda Coleman-Singleton',
  },
  {
    entityId: 'ent_emmett_till_001',
    predicate: 'was lynched',
    object: 'in Mississippi in August 1955, at the age of fourteen',
    citationSource: 'nps.gov',
    citationHref: 'https://www.nps.gov/places/graball-landing.htm',
    citationLabel:
      "Fourteen-year-old Emmett Till's body was found near Graball Landing on the Tallahatchie River following his lynching in 1955.",
    confidenceLevel: 'high',
  },
];

type Row = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly claims: readonly ReleaseClaimProjection[] | null;
  readonly projection: Record<string, unknown> | null;
  readonly taxonomy: Record<string, unknown> | null;
};

/** Next id in the record's own `claim_<suffix>_NN` sequence, so ids stay stable and readable. */
function nextClaimId(entityId: string, claims: readonly ReleaseClaimProjection[]): string {
  const stem = `claim_${entityId.replace(/^ent_/u, '')}`;
  const used = claims
    .map((claim) => new RegExp(`^${stem}_(\\d+)$`, 'u').exec(claim.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number.parseInt(value, 10));
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1;
  return `${stem}_${String(next).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const active = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.v_active_release_id`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    const { rows } = await client.query<Row>(
      `SELECT entity_id, display_name, kind, summary, claims, projection, taxonomy
         FROM bb_public.release_entities WHERE release_id = $1 AND entity_id = ANY($2)`,
      [releaseId, ADDITIONS.map((a) => a.entityId)],
    );

    type Write = {
      readonly addition: ClaimAddition;
      readonly row: Row;
      readonly claims: readonly ReleaseClaimProjection[];
      readonly basis: readonly NotabilityBasisRecord[];
      readonly beforeBasis: readonly string[];
    };
    const writes: Write[] = [];

    console.log('=== Add the missing killing claim ===');
    console.log(`Release: ${releaseId}`);

    for (const addition of ADDITIONS) {
      const row = rows.find((candidate) => candidate.entity_id === addition.entityId);
      if (!row) {
        console.log(`\n  MISSING from the release: ${addition.entityId}`);
        continue;
      }
      // Read the copy the web app renders. The two can disagree — a previous run of this script
      // wrote the column alone — and repairing the one nobody reads fixes nothing.
      const projectionClaims = row.projection?.claims;
      const existing = Array.isArray(projectionClaims)
        ? (projectionClaims as ReleaseClaimProjection[])
        : Array.isArray(row.claims)
          ? row.claims
          : [];
      const already = existing.some(
        (claim) =>
          claim.predicate === addition.predicate && claim.object.trim() === addition.object.trim(),
      );
      if (already) {
        console.log(`\n  ${row.display_name}: already carries this claim, nothing to do.`);
        continue;
      }

      const replaceIndex =
        addition.replacesObject === undefined
          ? -1
          : existing.findIndex(
              (claim) =>
                claim.predicate === addition.predicate &&
                claim.object.trim() === addition.replacesObject?.trim(),
            );
      if (addition.replacesObject !== undefined && replaceIndex < 0) {
        console.log(
          `\n  ${row.display_name}: expected a "${addition.predicate} | ${addition.replacesObject}" claim to rewrite and found none. Skipped rather than guessed.`,
        );
        continue;
      }

      const written = {
        id:
          replaceIndex >= 0 ? existing[replaceIndex]!.id : nextClaimId(addition.entityId, existing),
        predicate: addition.predicate,
        object: addition.object,
        claimRole: 'evidence',
        confidenceLevel: addition.confidenceLevel,
        citationSource: addition.citationSource,
        citationHref: addition.citationHref,
        citationLabel: addition.citationLabel,
      } as ReleaseClaimProjection;
      const claims =
        replaceIndex >= 0
          ? existing.map((claim, index) => (index === replaceIndex ? written : claim))
          : [...existing, written];

      // Only `kind`, `displayName` and `summary` are read on this path.
      const entry = {
        kind: row.kind,
        displayName: row.display_name,
        summary: row.summary ?? '',
      } as unknown as ReleaseSourceEntity;
      const basis = buildReleaseNotabilityBasis(entry, claims);
      const beforeBasis = [
        ...new Set(
          ((row.projection?.notabilityBasis ?? []) as NotabilityBasisRecord[]).map(
            (record) => record.criterion,
          ),
        ),
      ];

      console.log(`\n  ${row.display_name} (${row.entity_id})`);
      console.log(
        `    ${replaceIndex >= 0 ? '~ rewrote ' : '+ claim   '} ${addition.predicate} | ${addition.object}`,
      );
      if (replaceIndex >= 0) {
        console.log(`      was      ${addition.predicate} | ${addition.replacesObject ?? ''}`);
      }
      console.log(`      source   ${addition.citationSource} (${addition.confidenceLevel})`);
      console.log(
        `    criteria : ${beforeBasis.join(', ') || '(none)'} -> ${[...new Set(basis.map((b) => b.criterion))].join(', ')}`,
      );
      for (const record of basis) console.log(`      · ${record.note.slice(0, 110)}`);
      writes.push({ addition, row, claims, basis, beforeBasis });
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 FIX_MISSING_KILLING_CLAIMS_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const write of writes) {
        const labels = [...new Set(write.basis.map((b) => NOTABILITY_RUBRIC[b.criterion]))];
        await client.query(
          // A released row keeps THREE copies of its claims: the `claims` column, `projection.claims`
          // (what the web app actually renders), and `projection.claimIds`. Writing only the column
          // left the page showing "Killed Sharonda Coleman-Singleton" while the database held the
          // repaired claim. Same stale-copy trap as repo-rm2y and repo-8x306 — all copies or none.
          `UPDATE bb_public.release_entities
             SET claims = $1::jsonb,
                 projection = COALESCE(projection, '{}'::jsonb)
                   || jsonb_build_object(
                        'claims', $1::jsonb,
                        'claimIds', $2::jsonb,
                        'notabilityBasis', $3::jsonb,
                        'notabilityLabels', $4::jsonb),
                 taxonomy = CASE
                   WHEN taxonomy ? 'notabilityLabels'
                     THEN taxonomy || jsonb_build_object('notabilityLabels', $4::jsonb)
                   ELSE taxonomy END
           WHERE release_id = $5 AND entity_id = $6`,
          [
            JSON.stringify(write.claims),
            JSON.stringify(write.claims.map((claim) => claim.id)),
            JSON.stringify(write.basis),
            JSON.stringify(labels),
            releaseId,
            write.row.entity_id,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nApplied: ${writes.length} record(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
