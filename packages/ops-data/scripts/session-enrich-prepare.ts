/**
 * repo-n7p6.4 (WS4) — session-driven variant of enrich-entities-llm.ts.
 *
 * Prints the exact same prompts the harness would send to OpenRouter, but for an operator (or
 * the Claude Code session itself, via a Haiku subagent) to answer directly — no OpenRouter
 * spend, no separate ANTHROPIC_API_KEY. The prompt content comes from the SAME
 * buildEnrichmentUserPrompt/ENTITY_ENRICHMENT_SYSTEM_PROMPT/fetchEnrichmentSubjects that
 * enrich-entities-llm.ts uses, so a session-drafted answer and an OpenRouter-drafted answer are
 * validated by the exact same rules in validateEnrichmentResponse — nothing about the trust
 * model changes, only who answers.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-enrich-prepare.ts --entity-ids=id1,id2,...
 *
 * Prints one JSON object per line to stdout:
 *   { entityId, displayName, systemPrompt, userPrompt }
 * Pair with session-enrich-apply.ts, which takes back { entityId, rawContent } answers.
 */
import pg from 'pg';
import { TOPIC_REGISTRY } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  ENTITY_ENRICHMENT_SYSTEM_PROMPT,
  buildEnrichmentUserPrompt,
} from './lib/entity-enrichment-llm.ts';
import { fetchEnrichmentSubjects } from './lib/entity-enrichment-fetch.ts';

const ALLOWED_TOPIC_IDS = TOPIC_REGISTRY.map((topic) => topic.id);

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

async function main(): Promise<void> {
  if (ENTITY_IDS.length === 0) throw new Error('--entity-ids=id1,id2,... is required');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const { subjects, skippedNoEvidence } = await fetchEnrichmentSubjects(pool, ENTITY_IDS);
  if (skippedNoEvidence.length > 0) {
    console.error(
      `Skipping ${skippedNoEvidence.length} entit(ies) with no captured evidence: ` +
        skippedNoEvidence.join(', '),
    );
  }
  for (const subject of subjects) {
    process.stdout.write(
      `${JSON.stringify({
        entityId: subject.entityId,
        displayName: subject.displayName,
        systemPrompt: ENTITY_ENRICHMENT_SYSTEM_PROMPT,
        userPrompt: buildEnrichmentUserPrompt(subject, ALLOWED_TOPIC_IDS),
      })}\n`,
    );
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
