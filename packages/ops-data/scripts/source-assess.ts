/**
 * Isolated source assessment for hosts the source register cannot place from Wikidata
 * (`source-register.ts propose` says `review` or `reject`). Owner decision 2026-11-25: such
 * hosts are assessed by the framework, not sent to the owner one URL at a time.
 *
 * Two assessors read the SAME brief, one from each vendor, and neither is told which record or
 * claim the host would unblock, so neither has a reason to want a pass:
 *
 *   brief --host <host>                    print the brief (hand it to a Claude subagent as-is)
 *   sol --hosts=a,b --out=<jsonl> --work-dir=<dir outside repo> [--concurrency=4]   run Sol
 *   combine --claude <jsonl> --sol <jsonl> --out <json>           pair them for apply-assessment
 *
 * Each JSONL line is `{ host, label, assessment }`, where `assessment` matches
 * SourceAssessment. The Claude subagent writes its own line with
 * `actorId: "claude-session:<model>"` and `family: "anthropic"`. Then:
 *
 *   source-register.ts apply-assessment --file <json> [--dry-run]
 *
 * which registers a host only when both recommend it, each cites a page about it from another
 * host, and takes the lower class (`entryFromAssessments`). Sol sees only the host name and the
 * public web. See docs/research/source-assessment.md.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPool } from '../../operator-cli/src/map-pool.ts';
import { runCodexExec } from './lib/codex-exec.ts';
import { SOURCE_REGISTER_ORG_TYPES } from './lib/source-register.ts';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

export const ASSESSMENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'recommendation', 'orgType', 'reason', 'evidence'],
  properties: {
    label: { type: 'string', description: "The publisher's name as it presents itself." },
    recommendation: { type: 'string', enum: ['register', 'refuse'] },
    orgType: { type: 'string', enum: [...SOURCE_REGISTER_ORG_TYPES] },
    reason: { type: 'string', description: 'Two to four sentences: who publishes it and why.' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'quote'],
        properties: { url: { type: 'string' }, quote: { type: 'string' } },
      },
    },
  },
} as const;

export function assessmentBrief(host: string): string {
  return [
    `Assess the web publisher at ${host} as a source for a history catalog. You are judging the`,
    'publisher, not any particular page or fact on it. Research it on the open web.',
    '',
    'Find out, from pages you actually open:',
    '1. Who publishes it: a named organization or person, its ownership, and how long it has existed.',
    '2. Whether it has editors, bylines, a corrections practice, or other editorial accountability.',
    '3. What independent parties say about it: news coverage, libraries, universities, press',
    '   associations, awards, directories of record. Quote at least one such page that is NOT on',
    `   ${host} itself and is not Wikipedia; the publisher describing itself does not count, and`,
    '   Wikipedia is only a lead to other sources.',
    '4. Whether it is mainly about its own organization (a company, church or newspaper describing',
    '   itself). That is fine for a newspaper reporting news, but a site that mostly promotes its',
    '   owner is self-published.',
    '',
    'Recommend "register" only for an accountable publisher a careful historian would cite: a',
    'newspaper with real reporting, a museum, archive, library, historical society, university,',
    'encyclopedia with an editorial staff, research institute or similar. Recommend "refuse" for',
    'anonymous or unaccountable sites, commercial directories, marketplaces, SEO or content farms,',
    'user-generated content, personal blogs, and self-published promotional sites. When the',
    'evidence is thin, refuse. Never choose government_agency; a government body belongs on a',
    'government domain.',
    '',
    'orgType: pick the closest of the allowed values (a newspaper is news_publisher).',
    'evidence: each item is a URL you opened and an exact passage copied from it.',
    'Return only the JSON object the output schema describes.',
  ].join('\n');
}

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback === undefined) throw new Error(`--${name}= is required`);
  return fallback;
}

const jsonl = (path: string): Record<string, unknown>[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);

/** Pair each host's Claude and Sol lines into the apply-assessment input; unpaired hosts are listed. */
export function combineAssessments(
  claude: readonly Record<string, unknown>[],
  sol: readonly Record<string, unknown>[],
): { rows: { host: string; label: string; assessments: unknown[] }[]; unpaired: string[] } {
  const solByHost = new Map(sol.map((row) => [String(row.host), row]));
  const rows: { host: string; label: string; assessments: unknown[] }[] = [];
  const unpaired: string[] = [];
  for (const row of claude) {
    const host = String(row.host);
    const other = solByHost.get(host);
    if (other === undefined) {
      unpaired.push(host);
      continue;
    }
    solByHost.delete(host);
    rows.push({
      host,
      label: String(row.label ?? other.label ?? host),
      assessments: [row.assessment, other.assessment],
    });
  }
  unpaired.push(...solByHost.keys());
  return { rows, unpaired };
}

async function runSol(): Promise<void> {
  const hosts = flag('hosts')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const out = flag('out');
  const model = flag('model', 'gpt-6.1-sol');
  const concurrency = Number(flag('concurrency', '4'));
  const workDir = resolve(flag('work-dir'));
  if (workDir === REPO_ROOT || workDir.startsWith(`${REPO_ROOT}/`)) {
    throw new Error('--work-dir must be outside the repository');
  }
  mkdirSync(workDir, { recursive: true });
  const schemaPath = join(workDir, 'assessment-schema.json');
  writeFileSync(schemaPath, JSON.stringify(ASSESSMENT_OUTPUT_SCHEMA));
  // Hosts are assessed `concurrency` at a time; output keeps host order.
  const lines = await mapPool(
    hosts,
    async (host) => {
      const outputPath = join(workDir, `${host}.json`);
      if (existsSync(outputPath)) rmSync(outputPath);
      const result = await runCodexExec({
        model,
        workDir,
        schemaPath,
        outputPath,
        prompt: assessmentBrief(host),
        timeoutMs: 15 * 60_000,
        config: ['web_search=live'],
      });
      if (result.status !== 0 || !existsSync(outputPath)) {
        console.error(
          `${host}: codex failed (status ${result.status}); ${result.stderr.slice(-300)}`,
        );
        return undefined;
      }
      const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as Record<string, unknown>;
      const { label, ...rest } = parsed;
      console.log(`${host}: ${String(parsed.recommendation)} (${String(parsed.orgType)})`);
      return JSON.stringify({
        host,
        label,
        assessment: { actorId: `codex-review:${model}`, family: 'openai', ...rest },
      });
    },
    { concurrency },
  );
  writeFileSync(
    out,
    lines
      .filter((line) => line !== undefined)
      .map((line) => `${line}\n`)
      .join(''),
  );
}

function main(): void {
  const verb = process.argv[2];
  if (verb === 'brief') {
    console.log(assessmentBrief(flag('host')));
    console.log(`\nOutput schema:\n${JSON.stringify(ASSESSMENT_OUTPUT_SCHEMA, null, 2)}`);
  } else if (verb === 'sol') {
    runSol().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  } else if (verb === 'combine') {
    const { rows, unpaired } = combineAssessments(jsonl(flag('claude')), jsonl(flag('sol')));
    writeFileSync(flag('out'), JSON.stringify(rows, null, 2));
    console.log(`paired ${rows.length}; unpaired: ${unpaired.join(', ') || 'none'}`);
  } else {
    console.error('usage: source-assess.ts <brief|sol|combine> [options]');
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) main();
