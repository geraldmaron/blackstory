/**
 * repo-qauh — dump enrichment subjects (evidence + allowed topic ids) as JSON so an in-session
 * agent can draft the tier-0 `--session-answers` payload `enrich-entities-llm.ts` already
 * accepts.
 *
 * Why this exists: the enrichment harness's tier 0 takes session-drafted answers and costs
 * nothing, but nothing wrote them out in a draftable shape — the evidence lived only inside the
 * harness's own prompt construction, so drafting meant either calling a metered provider or
 * hand-assembling the subject payload and risking a mismatch with what validation checks.
 *
 * This reuses `fetchEnrichmentSubjects` — the SAME function the harness calls — so a draft is
 * written against exactly the evidence text, evidence ids, and truncation the validator will
 * later anchor citations against. Restating the query here would let the two drift, and a
 * citation quote is validated as a verbatim substring of evidence text: an off-by-one truncation
 * between dump and validate turns every draft into a quarantine.
 *
 * Read-only. No writes, no network, no model calls.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/dump-enrichment-subjects.ts \
 *     --lanes=nrhp-black-heritage --limit=25 --out=.cache/enrichment-subjects/batch-01.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { TOPIC_REGISTRY } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { selectEntitiesForEnrichment } from './lib/entity-enrichment-selector.ts';
import { fetchEnrichmentSubjects } from './lib/entity-enrichment-fetch.ts';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANES = flag('lanes', '')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0);
const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const LIMIT = Number.parseInt(flag('limit', '25'), 10);
const OUT = flag('out', '.cache/enrichment-subjects/subjects.json');

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  // The selector has no limit parameter — it answers "which entities are candidates", and the
  // batch size is the caller's business. Slicing here keeps that split intact.
  let entityIds: readonly string[] = ENTITY_IDS;
  if (entityIds.length === 0) {
    const selected = await selectEntitiesForEnrichment(pool, { lanes: LANES });
    entityIds = selected.slice(0, LIMIT);
  }

  const { subjects, skippedNoEvidence } = await fetchEnrichmentSubjects(pool, entityIds);
  await pool.end();

  // Only subjects that actually carry evidence are draftable. A subject with none is reported,
  // never padded — the sweep's own discipline ("an entity with no evidence keeps its thin-record
  // state, it does not get generic prose") applies just as much to a session drafter.
  const allowedTopicIds = TOPIC_REGISTRY.map((topic) => topic.id);
  const payload = {
    generatedAt: new Date().toISOString(),
    allowedTopicIds,
    skippedNoEvidence,
    subjects: subjects.map((subject) => ({
      entityId: subject.entityId,
      displayName: subject.displayName,
      kind: subject.kind,
      lane: subject.lane,
      restrictedAddress: subject.restrictedAddress,
      evidence: subject.evidence.map((item) => ({
        id: item.id,
        sourceTier: item.sourceTier,
        title: item.title,
        text: item.text,
      })),
    })),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    `Subjects with evidence: ${subjects.length}. No evidence (not draftable): ${skippedNoEvidence.length}.`,
  );
  console.log(`Allowed topic ids: ${allowedTopicIds.length}`);
  console.log(`Written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
