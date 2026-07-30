/**
 * Apply operator death-review verdicts for landscape living-status-review rows.
 *
 * Reads a TSV produced by cross-reference review:
 *   entity_id display_name mined_year mined_signal verdict true_death_year confidence reason
 *
 * - approve: mark personReview approved; set living_status=deceased
 * - reject + high-confidence true death year: correct deathYear, approve, write deceased
 * - reject without trusted death year: quarantine candidate; leave canonical unknown
 *
 * Usage:
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   DEATH_REVIEW_VERDICTS=/tmp/bfjq-death-review-verdicts.tsv \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-death-review-verdicts.ts
 *
 * Apply:
 *   DRY_RUN=0 APPLY_DEATH_REVIEW_VERDICTS=1 ...
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY_DEATH_REVIEW_VERDICTS === '1';
const VERDICTS_PATH =
  process.env.DEATH_REVIEW_VERDICTS?.trim() || '/tmp/bfjq-death-review-verdicts.tsv';
const ACTOR = process.env.OPERATOR_ID?.trim() || 'ops-data/apply-death-review-verdicts';
const LANE = 'living-status-review';

type Verdict = {
  readonly entityId: string;
  readonly displayName: string;
  readonly minedYear: number;
  readonly minedSignal: string;
  readonly verdict: 'approve' | 'reject';
  readonly trueDeathYear: number | null;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly reason: string;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function parseVerdicts(text: string): Verdict[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('entity_id\t'));
  const out: Verdict[] = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 8) {
      throw new Error(`Malformed verdict line (need 8+ columns): ${line.slice(0, 120)}`);
    }
    const [
      entityId,
      displayName,
      minedYearRaw,
      minedSignal,
      verdictRaw,
      trueDeathYearRaw,
      confidenceRaw,
      ...reasonParts
    ] = parts;
    const verdict = verdictRaw === 'approve' || verdictRaw === 'reject' ? verdictRaw : null;
    const confidence =
      confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
        ? confidenceRaw
        : null;
    if (!verdict || !confidence) {
      throw new Error(`Invalid verdict/confidence on ${entityId}`);
    }
    const minedYear = Number.parseInt(minedYearRaw, 10);
    const trueDeathYear =
      trueDeathYearRaw.trim() === '' ? null : Number.parseInt(trueDeathYearRaw, 10);
    if (!Number.isFinite(minedYear)) throw new Error(`Bad mined year for ${entityId}`);
    if (trueDeathYear !== null && !Number.isFinite(trueDeathYear)) {
      throw new Error(`Bad true death year for ${entityId}`);
    }
    out.push({
      entityId,
      displayName,
      minedYear,
      minedSignal,
      verdict,
      trueDeathYear,
      confidence,
      reason: reasonParts.join('\t'),
    });
  }
  return out;
}

function shouldWriteDeceased(v: Verdict): boolean {
  if (v.verdict === 'approve') return true;
  // Cross-referenced death year with high confidence despite bad mined signal.
  return v.trueDeathYear !== null && v.confidence === 'high';
}

async function main(): Promise<void> {
  const verdicts = parseVerdicts(readFileSync(VERDICTS_PATH, 'utf8'));
  const writeDeceased = verdicts.filter(shouldWriteDeceased);
  const quarantine = verdicts.filter((v) => !shouldWriteDeceased(v));

  console.log('=== Apply death-review verdicts ===');
  console.log(`Verdicts loaded: ${verdicts.length}`);
  console.log(`Write deceased:  ${writeDeceased.length}`);
  console.log(`Quarantine only: ${quarantine.length}`);

  for (const v of writeDeceased) {
    const year = v.verdict === 'approve' ? v.minedYear : v.trueDeathYear!;
    const mode = v.verdict === 'approve' ? 'approve' : 'correct';
    console.log(`  ${mode} ${v.entityId} (${v.displayName}) deathYear=${year}`);
  }
  for (const v of quarantine) {
    console.log(`  quarantine ${v.entityId} (${v.displayName}): ${v.reason.slice(0, 100)}`);
  }

  if (DRY_RUN || !APPLY) {
    console.log('\nDry run only. Set DRY_RUN=0 APPLY_DEATH_REVIEW_VERDICTS=1 to apply.');
    return;
  }

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  let landscapeUpdated = 0;
  let canonicalUpdated = 0;
  let quarantined = 0;
  const nowIso = new Date().toISOString();

  try {
    await client.query('BEGIN');

    for (const v of writeDeceased) {
      const deathYear = v.verdict === 'approve' ? v.minedYear : (v.trueDeathYear as number);
      const personReview = {
        livingStatus: 'deceased',
        deathYear,
        signal: v.minedSignal,
        approved: true,
        approvedBy: ACTOR,
        approvedAt: nowIso,
        basis: v.reason,
        minedYear: v.minedYear,
        ...(v.verdict === 'reject' ? { correctedFromMinedYear: true } : {}),
      };

      const landscape = await client.query(
        `UPDATE bb_research.landscape_candidates
         SET status = 'accepted',
             summary = $2,
             payload = jsonb_set(
               coalesce(payload, '{}'::jsonb),
               '{personReview}',
               $3::jsonb,
               true
             ),
             provenance = coalesce(provenance, '{}'::jsonb) || $4::jsonb,
             updated_at = now()
         WHERE lane = $5 AND source_item_id = $1
         RETURNING id`,
        [
          v.entityId,
          `Operator-approved deceased (${deathYear}): ${v.reason.slice(0, 160)}`,
          JSON.stringify(personReview),
          JSON.stringify({
            review_verdict: v.verdict,
            review_confidence: v.confidence,
            review_reason: v.reason,
            reviewed_at: nowIso,
            reviewed_by: ACTOR,
          }),
          LANE,
        ],
      );
      landscapeUpdated += landscape.rowCount ?? 0;

      const canonical = await client.query(
        `UPDATE bb_canonical.entities
         SET living_status = 'deceased',
             living_status_derived = coalesce(living_status_derived, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         WHERE id = $1 AND living_status IS DISTINCT FROM 'deceased'
         RETURNING id`,
        [
          v.entityId,
          JSON.stringify({
            status: 'deceased',
            signal: 'operator_death_review',
            deathYear,
            derivedAt: nowIso,
            lane: 'living-status-review',
            basis: v.reason,
          }),
        ],
      );
      canonicalUpdated += canonical.rowCount ?? 0;
    }

    for (const v of quarantine) {
      const result = await client.query(
        `UPDATE bb_research.landscape_candidates
         SET status = 'quarantined',
             summary = $2,
             provenance = coalesce(provenance, '{}'::jsonb) || $3::jsonb,
             updated_at = now()
         WHERE lane = $4 AND source_item_id = $1 AND status = 'pending'
         RETURNING id`,
        [
          v.entityId,
          `Quarantined text-mined death signal: ${v.reason.slice(0, 180)}`,
          JSON.stringify({
            review_verdict: 'reject',
            review_confidence: v.confidence,
            review_reason: v.reason,
            reviewed_at: nowIso,
            reviewed_by: ACTOR,
          }),
          LANE,
        ],
      );
      quarantined += result.rowCount ?? 0;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  console.log(`\nApplied landscape accepted/updated: ${landscapeUpdated}`);
  console.log(`Applied canonical deceased writes:   ${canonicalUpdated}`);
  console.log(`Quarantined landscape rows:          ${quarantined}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
