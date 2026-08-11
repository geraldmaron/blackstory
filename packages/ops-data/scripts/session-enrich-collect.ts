/**
 * repo-n7p6.4 (WS4) — collect a fan-out batch of session-drafted answers into the answers.jsonl
 * that session-enrich-apply.ts consumes.
 *
 * Why this exists: session-enrich-prepare.ts emits one prompt per line and session-enrich-apply.ts
 * takes back { entityId, rawContent } per line, but nothing joined the two when the drafting is
 * done by a FAN-OUT of subagents rather than by the orchestrating session itself. Each subagent
 * writes drafts/draft-<line>.json (or drafts/refuse-<line>.json), and this maps those back onto
 * the entity ids by line number.
 *
 * The line number is the join key on purpose. A subagent is given line numbers, not entity ids, so
 * it cannot silently draft for the wrong subject: a draft file's name is the only thing that binds
 * it to an entity, and that binding is resolved here from the prompts file rather than from
 * anything the subagent wrote.
 *
 * REFUSALS ARE NOT FAILURES. A subject whose captured evidence carries no Black-history
 * significance should be refused, not padded to reach the 120-char summary floor. Those are
 * reported and written to a separate file for triage — see repo-y7hd, which is about the ledger
 * having no terminal state to record them in. Until that lands, a refused subject stays 'pending'
 * and will be re-offered on the next pass.
 *
 * This validates NOTHING itself. Everything it emits still goes through
 * session-enrich-apply.ts -> validateEnrichmentResponse, which is the single validator for both
 * the OpenRouter and the session path. Adding checks here would create a second, drifting copy.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-enrich-collect.ts \
 *     --prompts=<dir>/prompts.jsonl --drafts=<dir>/drafts --out=<dir>/answers.jsonl
 *
 * Then, to validate (dry-run) and apply:
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-enrich-apply.ts --answers-file=<dir>/answers.jsonl
 *   DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 SESSION_ENRICH_MODEL_ID=<who-actually-drafted> \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-enrich-apply.ts --answers-file=<dir>/answers.jsonl
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const PROMPTS = flag('prompts', '');
const DRAFTS = flag('drafts', '');
const OUT = flag('out', '');

function main(): void {
  if (!PROMPTS || !DRAFTS || !OUT) {
    throw new Error('--prompts=, --drafts= and --out= are all required');
  }

  const subjects = readFileSync(PROMPTS, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { entityId: string; displayName: string });

  const answers: string[] = [];
  const refusals: unknown[] = [];
  const missing: string[] = [];

  for (const [index, subject] of subjects.entries()) {
    const lineNo = index + 1;
    const draftPath = join(DRAFTS, `draft-${lineNo}.json`);
    const refusePath = join(DRAFTS, `refuse-${lineNo}.json`);

    if (existsSync(draftPath)) {
      // Passed through as the raw string, not re-serialized: the validator anchors citation
      // quotes as verbatim substrings, and a JSON round-trip here could normalise a character
      // the subagent copied correctly out of the evidence.
      answers.push(
        JSON.stringify({ entityId: subject.entityId, rawContent: readFileSync(draftPath, 'utf8') }),
      );
    } else if (existsSync(refusePath)) {
      const parsed = JSON.parse(readFileSync(refusePath, 'utf8')) as Record<string, unknown>;
      refusals.push({ line: lineNo, entityId: subject.entityId, ...parsed });
    } else {
      missing.push(`${lineNo} (${subject.entityId} — ${subject.displayName})`);
    }
  }

  writeFileSync(OUT, answers.length > 0 ? `${answers.join('\n')}\n` : '');
  const refusalsOut = `${OUT.replace(/\.jsonl$/, '')}.refusals.json`;
  writeFileSync(refusalsOut, `${JSON.stringify(refusals, null, 2)}\n`);

  console.log(`Subjects: ${subjects.length}`);
  console.log(`Drafts collected: ${answers.length} -> ${OUT}`);
  console.log(`Refused: ${refusals.length} -> ${refusalsOut}`);
  // Loudly, because a silently missing draft is a subagent that died, and the subject would
  // otherwise just look like it was never in the batch.
  if (missing.length > 0) {
    console.log(`NO OUTPUT AT ALL for ${missing.length} subject(s) — a drafter likely died:`);
    for (const entry of missing.slice(0, 20)) console.log(`  - line ${entry}`);
    if (missing.length > 20) console.log(`  ...and ${missing.length - 20} more`);
  }
}

main();
