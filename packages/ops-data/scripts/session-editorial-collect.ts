/**
 * Collects a fan-out batch of session-drafted editorial judgments into the answers.jsonl
 * that session-editorial-apply.ts consumes. Mirrors session-enrich-collect.ts's pattern
 * (same line-number join, same "never both files" contract) for the editorial-judge lane,
 * where the subject key is `subjectId` rather than `entityId`.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-editorial-collect.ts \
 *     --prompts=<dir>/prompts.jsonl --drafts=<dir>/drafts --out=<dir>/answers.jsonl
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
    .map((line) => JSON.parse(line) as { subjectId: string; title: string });

  const answers: string[] = [];
  const missing: string[] = [];

  for (const [index, subject] of subjects.entries()) {
    const lineNo = index + 1;
    const draftPath = join(DRAFTS, `draft-${lineNo}.json`);

    if (existsSync(draftPath)) {
      answers.push(
        JSON.stringify({
          subjectId: subject.subjectId,
          rawContent: readFileSync(draftPath, 'utf8'),
        }),
      );
    } else {
      missing.push(`${lineNo} (${subject.subjectId} — ${subject.title})`);
    }
  }

  writeFileSync(OUT, answers.length > 0 ? `${answers.join('\n')}\n` : '');

  console.log(`Subjects: ${subjects.length}`);
  console.log(`Drafts collected: ${answers.length} -> ${OUT}`);
  if (missing.length > 0) {
    console.log(`NO OUTPUT AT ALL for ${missing.length} subject(s) — a drafter likely died:`);
    for (const entry of missing.slice(0, 20)) console.log(`  - line ${entry}`);
    if (missing.length > 20) console.log(`  ...and ${missing.length - 20} more`);
  }
}

main();
