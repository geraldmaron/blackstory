/**
 * repo-n7p6.4 (WS4) — takes back { entityId, rawContent } answers from a session/Haiku-driven
 * pass (paired with session-enrich-prepare.ts) and runs them through the EXACT SAME
 * validateEnrichmentResponse + applyEnrichmentResult path enrich-entities-llm.ts uses. A
 * session-drafted answer gets no special trust: it is re-anchored against the same evidence rows
 * fetchEnrichmentSubjects returns and rejected the same way an OpenRouter answer would be.
 *
 * costUsdEstimate is always 0 for a session-drafted answer — no metered OpenRouter/Anthropic
 * call was made; the cost was this session's own turn.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-enrich-apply.ts --answers-file=/path/to/answers.jsonl \
 *       [--refusals-file=/path/to/answers.refusals.json]
 *
 * answers.jsonl: one JSON object per line, { "entityId": "...", "rawContent": "...raw JSON draft..." }
 *
 * repo-n9dq: `--refusals-file` takes the companion file session-enrich-collect.ts already writes
 * and records each refusal as terminal `no-lane-significance` rather than leaving the row
 * `pending`. Both outcomes of a wave belong in one command — a refusal recorded in a separate
 * step is a refusal that gets skipped, and skipping it is what made wave 4's selection consist
 * mostly of wave 3's own refusals.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { TOPIC_REGISTRY } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { validateEnrichmentResponse, type EnrichmentAttempt } from './lib/entity-enrichment-llm.ts';
import { fetchEnrichmentSubjects } from './lib/entity-enrichment-fetch.ts';
import {
  applyEnrichmentResult,
  applyLaneSignificanceRefusal,
  isReviewSampled,
} from './lib/entity-enrichment-apply.ts';

/** repo-n7p6.16 item 5: same review-sampling of passing outputs as enrich-entities-llm.ts. */
const REVIEW_SAMPLE_RATE = Number.parseFloat(
  process.env.ENRICH_REVIEW_SAMPLE_RATE?.trim() || '0.05',
);

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.ENRICH_ENTITIES_LLM_APPLY === '1';
/** Records who actually drafted this — never a metered API model id, so cost stays honest. */
const SESSION_MODEL_ID =
  process.env.SESSION_ENRICH_MODEL_ID?.trim() || 'claude-haiku-4-5-20251001-session';

const ALLOWED_TOPIC_IDS = TOPIC_REGISTRY.map((topic) => topic.id);

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

type Answer = { readonly entityId: string; readonly rawContent: string };

function loadAnswers(path: string): readonly Answer[] {
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    const parsed = JSON.parse(line) as { entityId?: unknown; rawContent?: unknown };
    if (typeof parsed.entityId !== 'string' || typeof parsed.rawContent !== 'string') {
      throw new Error(`answers-file line ${index + 1}: missing entityId or rawContent`);
    }
    return { entityId: parsed.entityId, rawContent: parsed.rawContent };
  });
}

type Refusal = { readonly entityId: string; readonly reason: string };

/** The array session-enrich-collect.ts writes to `<out>.refusals.json`. */
function loadRefusals(path: string): readonly Refusal[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array`);
  return parsed.map((entry, index) => {
    const row = entry as { entityId?: unknown; reason?: unknown };
    if (typeof row.entityId !== 'string') {
      throw new Error(`refusals-file entry ${index}: missing entityId`);
    }
    // A reason is required, not defaulted. An unexplained terminal status is worse than none:
    // the whole point of the row is telling a later reader WHY the evidence was judged empty.
    if (typeof row.reason !== 'string' || row.reason.trim().length === 0) {
      throw new Error(`refusals-file entry ${index} (${row.entityId}): missing reason`);
    }
    return { entityId: row.entityId, reason: row.reason.trim() };
  });
}

async function main(): Promise<void> {
  const answersFile = flag('answers-file', '');
  if (!answersFile) throw new Error('--answers-file=/path/to/answers.jsonl is required');
  const answers = loadAnswers(answersFile);
  if (answers.length === 0) throw new Error(`${answersFile} contained no answers`);

  const refusalsFile = flag('refusals-file', '');
  const refusals = refusalsFile.length > 0 ? loadRefusals(refusalsFile) : [];

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const { subjects, skippedNoEvidence } = await fetchEnrichmentSubjects(
    pool,
    [...answers.map((answer) => answer.entityId), ...refusals.map((refusal) => refusal.entityId)],
  );
  const subjectById = new Map(subjects.map((subject) => [subject.entityId, subject]));
  if (skippedNoEvidence.length > 0) {
    console.log(
      `Skipping ${skippedNoEvidence.length} answer(s) with no captured evidence: ${skippedNoEvidence.join(', ')}`,
    );
  }

  type Result = {
    readonly entityId: string;
    readonly attempt: EnrichmentAttempt;
    readonly reviewSample: boolean;
  };
  const sampleSalt = new Date().toISOString().slice(0, 10);
  const results: Result[] = [];
  for (const answer of answers) {
    const subject = subjectById.get(answer.entityId);
    if (subject === undefined) continue;
    const attempt = validateEnrichmentResponse(subject, ALLOWED_TOPIC_IDS, answer.rawContent);
    const reviewSample =
      attempt.validation.ok && isReviewSampled(answer.entityId, REVIEW_SAMPLE_RATE, sampleSalt);
    results.push({ entityId: answer.entityId, attempt, reviewSample });
    const verdict = attempt.validation.ok ? 'accepted' : 'quarantined';
    const detail = attempt.validation.ok
      ? `"${attempt.validation.draft.summary.slice(0, 80)}…"` +
        (reviewSample ? ' [review sample]' : '')
      : attempt.validation.errors.slice(0, 2).join('; ');
    console.log(`${answer.entityId} (${subject.displayName}) — ${verdict} — ${detail}`);
  }

  const accepted = results.filter((result) => result.attempt.validation.ok);
  const rejected = results.filter((result) => !result.attempt.validation.ok);
  console.log(`\nAccepted: ${accepted.length}`);
  console.log(`Quarantined: ${rejected.length}`);
  if (results.length > 0) {
    console.log(`Quarantine rate: ${((rejected.length / results.length) * 100).toFixed(1)}%`);
  }
  console.log(`Model recorded: ${SESSION_MODEL_ID} (cost_usd=0, session-drafted)`);

  // A refusal is only a judgement about the entity if the evidence was really the entity's. A row
  // whose evidence has since been quarantined as mis-attached (repo-pjob) has nothing left to have
  // been judged, so recording it terminal would close a record that was never actually researched.
  // fetchEnrichmentSubjects reports exactly that condition, so the guard is free.
  const noEvidence = new Set(skippedNoEvidence);
  const recordable = refusals.filter((refusal) => !noEvidence.has(refusal.entityId));
  const unrecordable = refusals.filter((refusal) => noEvidence.has(refusal.entityId));
  if (refusals.length > 0) {
    console.log(`\nRefusals: ${refusals.length}`);
    for (const refusal of recordable) {
      const subject = subjectById.get(refusal.entityId);
      console.log(
        `  no-lane-significance — ${refusal.entityId} (${subject?.displayName ?? '?'}) — ` +
          `${refusal.reason.slice(0, 100)}`,
      );
    }
    if (unrecordable.length > 0) {
      console.log(
        `  NOT recorded (${unrecordable.length}): evidence is gone or was quarantined as ` +
          `mis-attached, so there is nothing to have judged — these are re-sweep candidates, ` +
          `not settled records (repo-pjob):`,
      );
      for (const refusal of unrecordable) console.log(`    ${refusal.entityId}`);
    }
  }

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no ledger writes. Set DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const result of results) {
      await applyEnrichmentResult(client, {
        entityId: result.entityId,
        attempt: result.attempt,
        modelId: SESSION_MODEL_ID,
        costUsdEstimate: 0,
        reviewSample: result.reviewSample,
      });
    }
    for (const refusal of recordable) {
      await applyLaneSignificanceRefusal(client, {
        entityId: refusal.entityId,
        reason: refusal.reason,
        evidenceDigest: subjectById.get(refusal.entityId)?.evidenceDigest ?? null,
        modelId: SESSION_MODEL_ID,
      });
    }
    await client.query('COMMIT');
    console.log(
      `\nApplied: ${results.length} ledger row(s) updated (${accepted.length} enriched, ${rejected.length} quarantined)` +
        `${recordable.length > 0 ? `, plus ${recordable.length} refused as no-lane-significance` : ''}.`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
