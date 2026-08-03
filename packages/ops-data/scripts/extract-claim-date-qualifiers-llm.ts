/**
 * Stage 2 — LLM extraction of dates from year-bearing prose claim objects into claim_qualifiers.
 *
 * EDC pattern: model returns { edtf, property, verbatim_quote, char_offsets }; a deterministic
 * validator rejects unanchored or unparseable output. Rejects go to quarantine artifacts
 * (and optionally bb_research.model_output_quarantine when ACTIVITY_ID is set).
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 EXTRACT_CLAIM_DATE_QUALIFIERS_LLM_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Provider (default mock):
 *   EXTRACT_CLAIM_DATE_LLM_PROVIDER=mock|openrouter|ollama|hybrid
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/extract-claim-date-qualifiers-llm.ts [--limit N]
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  buildClaimTemporalQualifierDraft,
  isYearBearingProseClaimObject,
} from '../../domain/src/temporal/index.ts';
import { createLlmProvider } from '../../operator-cli/src/llm-provider.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildClaimDateExtractionRequest,
  CLAIM_DATE_EXTRACTION_SCHEMA_ID,
  CLAIM_DATE_EXTRACTION_SCHEMA_VERSION,
  createMockClaimDateExtractionProvider,
  validateClaimDateExtractionResponse,
  type ClaimDateExtractionSubject,
} from './lib/claim-date-llm-extraction.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.EXTRACT_CLAIM_DATE_QUALIFIERS_LLM_APPLY === '1';
const PROVIDER_NAME = (process.env.EXTRACT_CLAIM_DATE_LLM_PROVIDER ?? 'mock') as
  'mock' | 'openrouter' | 'ollama' | 'hybrid';
const LIMIT = parseLimitArg();
const CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.EXTRACT_CLAIM_DATE_LLM_CONCURRENCY ?? '4', 10),
);
const CACHE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.cache/claim-date-extraction',
);

type ClaimRow = ClaimDateExtractionSubject;

type ExtractionStats = {
  readonly candidates: number;
  readonly attempted: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly skippedExisting: number;
  readonly inserted: number;
};

function parseLimitArg(): number | undefined {
  const index = process.argv.indexOf('--limit');
  if (index < 0) return undefined;
  const value = Number.parseInt(process.argv[index + 1] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function qualifierId(claimVersionId: string, property: string): string {
  const digest = createHash('sha256')
    .update(`${claimVersionId}|temporal|${property}`)
    .digest('hex');
  return `cq_${digest.slice(0, 24)}`;
}

async function loadStage2Candidates(client: pg.PoolClient): Promise<readonly ClaimRow[]> {
  const result = await client.query<{
    claim_id: string;
    claim_version_id: string;
    entity_id: string;
    predicate: string;
    object: unknown;
  }>(
    `SELECT
       c.id AS claim_id,
       v.id AS claim_version_id,
       c.entity_id,
       v.predicate,
       v.object
     FROM bb_canonical.claims c
     JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
     LEFT JOIN bb_canonical.claim_qualifiers q
       ON q.claim_version_id = v.id AND q.qualifier_type = 'temporal'
     WHERE c.current_version_id IS NOT NULL
       AND q.id IS NULL`,
  );

  const rows: ClaimRow[] = [];
  for (const row of result.rows) {
    const object = typeof row.object === 'string' ? row.object : JSON.stringify(row.object);
    if (buildClaimTemporalQualifierDraft(row.predicate, object)) continue;
    if (!isYearBearingProseClaimObject(object)) continue;
    rows.push({
      claimId: row.claim_id,
      claimVersionId: row.claim_version_id,
      entityId: row.entity_id,
      predicate: row.predicate,
      object,
    });
  }
  return rows;
}

async function countTemporalQualifiers(client: pg.PoolClient): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM bb_canonical.claim_qualifiers WHERE qualifier_type = 'temporal'`,
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

async function insertAcceptedQualifier(
  client: pg.PoolClient,
  subject: ClaimDateExtractionSubject,
  property: string,
  value: Record<string, unknown>,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO bb_canonical.claim_qualifiers (
       id, claim_version_id, qualifier_type, property, value
     ) VALUES ($1, $2, 'temporal', $3, $4::jsonb)
     ON CONFLICT (claim_version_id, qualifier_type, property) DO NOTHING`,
    [
      qualifierId(subject.claimVersionId, property),
      subject.claimVersionId,
      property,
      JSON.stringify(value),
    ],
  );
  return result.rowCount ?? 0;
}

async function quarantineRejected(
  client: pg.PoolClient,
  activityId: string | undefined,
  rawOutput: string,
  validationErrors: readonly string[],
): Promise<void> {
  if (!activityId) return;
  const invocationId = randomUUID();
  await client.query(
    `INSERT INTO bb_research.model_invocations (
       id, activity_id, provider, model_id, model_family, provider_route, price_snapshot,
       prompt_hash, output_schema_id, output_schema_version, benchmark_version, raw_response, status
     ) VALUES (
       $1, $2, $3, $4, $5, '{}'::jsonb, '{}'::jsonb,
       $6, $7, $8, $9, $10, 'invalid'
     )`,
    [
      invocationId,
      activityId,
      PROVIDER_NAME,
      `${PROVIDER_NAME}-claim-date-extraction`,
      PROVIDER_NAME,
      createHash('sha256').update(rawOutput).digest('hex'),
      CLAIM_DATE_EXTRACTION_SCHEMA_ID,
      CLAIM_DATE_EXTRACTION_SCHEMA_VERSION,
      'claim-date-extraction-v1',
      rawOutput,
    ],
  );
  await client.query(
    `INSERT INTO bb_research.model_output_quarantine (
       id, invocation_id, raw_output, validation_errors, retention_until
     ) VALUES ($1, $2, $3, $4, now() + interval '90 days')`,
    [randomUUID(), invocationId, rawOutput, validationErrors],
  );
}

function resolveProvider() {
  if (PROVIDER_NAME === 'mock') {
    return createMockClaimDateExtractionProvider();
  }
  return createLlmProvider({ provider: PROVIDER_NAME });
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();
  const runId = new Date().toISOString().replace(/[:.]/gu, '-');
  const quarantinePath = join(CACHE_DIR, `quarantine-${runId}.jsonl`);
  const activityId = process.env.EXTRACT_CLAIM_DATE_LLM_ACTIVITY_ID?.trim() || undefined;

  try {
    const beforeQualifiers = await countTemporalQualifiers(client);
    const allCandidates = await loadStage2Candidates(client);
    const candidates = LIMIT === undefined ? allCandidates : allCandidates.slice(0, LIMIT);
    const provider = resolveProvider();

    console.log('=== Stage 2 claim date LLM extraction ===');
    console.log(`Provider: ${provider.id} (${PROVIDER_NAME})`);
    console.log(`Temporal qualifiers before: ${beforeQualifiers}`);
    console.log(
      `Stage 2 candidates (year-bearing prose, no temporal qualifier): ${allCandidates.length}`,
    );
    console.log(
      `Processing: ${candidates.length}${LIMIT !== undefined ? ` (--limit ${LIMIT})` : ''}`,
    );

    const attempts = await mapPool(candidates, CONCURRENCY, async (subject) => {
      const request = buildClaimDateExtractionRequest(subject);
      const completion = await provider.complete(request);
      return validateClaimDateExtractionResponse(subject, completion.content);
    });

    const accepted = attempts.filter((attempt) => attempt.validation.ok);
    const rejected = attempts.filter((attempt) => !attempt.validation.ok);

    let inserted = 0;
    const stats: ExtractionStats = {
      candidates: allCandidates.length,
      attempted: attempts.length,
      accepted: accepted.length,
      rejected: rejected.length,
      skippedExisting: 0,
      inserted: 0,
    };

    console.log(`Accepted: ${stats.accepted}`);
    console.log(`Rejected: ${stats.rejected}`);
    if (stats.attempted > 0) {
      const acceptanceRate = ((stats.accepted / stats.attempted) * 100).toFixed(1);
      console.log(`Acceptance rate (this batch): ${acceptanceRate}%`);
    }

    for (const attempt of accepted.slice(0, 5)) {
      if (!attempt.validation.ok) continue;
      console.log(
        `  ✓ ${attempt.subject.claimId} (${attempt.subject.predicate}): ` +
          `${attempt.validation.extraction.property} edtf=${attempt.validation.parsed.edtf}`,
      );
    }
    if (accepted.length > 5) console.log(`  ...and ${accepted.length - 5} more accepted`);

    if (rejected.length > 0) {
      mkdirSync(CACHE_DIR, { recursive: true });
      const lines = rejected.map((attempt) =>
        JSON.stringify({
          claimId: attempt.subject.claimId,
          claimVersionId: attempt.subject.claimVersionId,
          errors: attempt.validation.ok ? [] : attempt.validation.errors,
          rawContent: attempt.rawContent,
        }),
      );
      writeFileSync(quarantinePath, `${lines.join('\n')}\n`, 'utf8');
      console.log(`Quarantine artifact: ${quarantinePath}`);
    }

    if (DRY_RUN || !APPLY) {
      const projectedCoverage = beforeQualifiers + stats.accepted;
      const projectedPct = ((projectedCoverage / 6792) * 100).toFixed(1);
      console.log(
        `\nDry run only — no claim_qualifiers writes. ` +
          `Projected temporal qualifiers if batch applied: ${projectedCoverage} (${projectedPct}% of 6792 claims). ` +
          'Set DRY_RUN=0 and EXTRACT_CLAIM_DATE_QUALIFIERS_LLM_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const attempt of accepted) {
        if (!attempt.validation.ok) continue;
        const { extraction, parsed } = attempt.validation;
        const value = {
          edtf: parsed.edtf,
          precision: parsed.precision,
          provenance: 'llm_extracted',
          source: 'claim_object_prose',
          verbatim_quote: extraction.verbatimQuote,
          char_offsets: extraction.charOffsets,
        };
        inserted += await insertAcceptedQualifier(
          client,
          attempt.subject,
          extraction.property,
          value,
        );
      }

      if (activityId) {
        for (const attempt of rejected) {
          if (attempt.validation.ok) continue;
          await quarantineRejected(
            client,
            activityId,
            attempt.rawContent,
            attempt.validation.errors,
          );
        }
      }

      await client.query('COMMIT');
      const afterQualifiers = await countTemporalQualifiers(client);
      const coveragePct = ((afterQualifiers / 6792) * 100).toFixed(1);
      console.log(`\nApplied: inserted ${inserted} claim_qualifiers rows.`);
      console.log(
        `Temporal qualifiers after: ${afterQualifiers} (${coveragePct}% of 6792 claims).`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
