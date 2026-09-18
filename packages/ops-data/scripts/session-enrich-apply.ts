/**
 * Validate externally drafted enrichment against stored evidence and apply the shared intake path.
 * Reads { entityId, rawContent } JSONL from --answers-file and optional --refusals-file JSON.
 * Unknown provider cost stays null. Default is dry-run; writes require DRY_RUN=0 and
 * ENRICH_ENTITIES_LLM_APPLY=1. Uses the same review sampling as the model-driven importer.
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

const REVIEW_SAMPLE_RATE = Number.parseFloat(
  process.env.ENRICH_REVIEW_SAMPLE_RATE?.trim() || '0.05',
);

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.ENRICH_ENTITIES_LLM_APPLY === '1';
/** Private drafting provenance; an unspecified model is never replaced with a guessed identity. */
const SESSION_MODEL_ID =
  process.env.SESSION_ENRICH_MODEL_ID?.trim() || 'session-drafted-model-unspecified';

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

  const { subjects, skippedNoEvidence } = await fetchEnrichmentSubjects(pool, [
    ...answers.map((answer) => answer.entityId),
    ...refusals.map((refusal) => refusal.entityId),
  ]);
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
  console.log(`Model recorded: ${SESSION_MODEL_ID} (cost_usd=unknown, externally drafted)`);

  // A missing or misattached document cannot support a terminal no-significance judgment. Honor
  // both the subject loader's quarantined-evidence signal and an explicit MIS-ATTACHED drafting
  // verdict so unresolved entities remain researchable.
  const isMisattachedVerdict = (reason: string): boolean => /^\s*MIS-ATTACHED\b/iu.test(reason);
  const noEvidence = new Set(skippedNoEvidence);
  const blocked = (refusal: Refusal): boolean =>
    noEvidence.has(refusal.entityId) || isMisattachedVerdict(refusal.reason);
  const recordable = refusals.filter((refusal) => !blocked(refusal));
  const unrecordable = refusals.filter(blocked);
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
        `  NOT recorded (${unrecordable.length}): the evidence was mis-attached or is already ` +
          `gone, so there is nothing to have judged — these are re-sweep candidates, not settled ` +
          `records (repo-pjob, repo-nlcq):`,
      );
      for (const refusal of unrecordable) {
        const why = isMisattachedVerdict(refusal.reason)
          ? 'drafter flagged MIS-ATTACHED'
          : 'no captured evidence remains';
        console.log(`    ${refusal.entityId} — ${why}`);
      }
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
        costUsd: null,
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
