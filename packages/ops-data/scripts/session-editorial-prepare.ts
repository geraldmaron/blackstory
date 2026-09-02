/**
 * Session-driven variant of operator-cli's editorial-run: prints the exact same
 * system prompt + user payload the LLM-provider path sends, for a Claude Code session
 * (subagent) to answer directly instead of paying for OpenRouter/Ollama. Mirrors
 * session-enrich-prepare.ts's pattern for the entity-enrichment lane.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-editorial-prepare.ts \
 *     --subjects <subjects.json> --out <prompts.jsonl> [--catalog-sample <catalog.json>]
 *
 * Writes one JSON object per line to --out:
 *   { subjectId, title, systemPrompt, userPrompt }
 * Pair with session-editorial-collect.ts (drafts -> answers.jsonl) then
 * session-editorial-apply.ts (validate via the same buildEditorialPacket/validateEditorialDrafts
 * every other lane uses).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SYSTEM_PROMPT } from '../../operator-cli/src/editorial-run.ts';

type Subject = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly existingContext?: string;
  readonly sourceSnippets?: readonly string[];
};

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const subjectsPath = readArgFlag('--subjects');
  const outPath = readArgFlag('--out');
  if (!subjectsPath || !outPath) {
    console.error('Usage: --subjects <subjects.json> --out <prompts.jsonl>');
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(subjectsPath, 'utf8')) as { subjects?: readonly Subject[] };
  const subjects = data.subjects ?? [];

  mkdirSync(dirname(outPath), { recursive: true });
  const lines = subjects.map((subject) => {
    const userPayload = {
      subjectId: subject.subjectId,
      title: subject.title,
      kind: subject.kind ?? null,
      existingSummary: subject.existingSummary ?? null,
      existingContext: subject.existingContext ?? null,
      sourceSnippets: subject.sourceSnippets ?? [],
      // No live catalog sample in this offline session path — relatedEntityIds is validated
      // downstream against the real catalog before anything is promoted, so an empty sample
      // here just means the judge won't propose related-entity links, not that it can invent them.
      catalogSample: [],
    };
    return JSON.stringify({
      subjectId: subject.subjectId,
      title: subject.title,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify(userPayload),
    });
  });

  writeFileSync(outPath, lines.length > 0 ? `${lines.join('\n')}\n` : '');
  console.log(
    JSON.stringify({ subjectsRead: subjects.length, promptsWritten: lines.length, outPath }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
