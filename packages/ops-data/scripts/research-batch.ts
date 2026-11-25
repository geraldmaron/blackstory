/**
 * New records, one command: capture -> claim review -> ledger -> public-text review -> publish ->
 * catalog republish, for landscape ids that already carry their evidence. It runs the existing
 * steps in the order docs/research/claim-review-handoff.md fixes and stops the whole batch when a
 * step is incomplete. Exit codes of those steps are not trusted: the reviewer exits 0 with
 * verdicts missing and the ledger apply exits 0 with refusals, so each result is read and counted.
 *
 * Dry run by default: packets, Sol's claim review and the ledger dry run, nothing written.
 * DATA LEAVES THIS MACHINE in both modes (claim and source text go to OpenAI through Codex).
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   DATABASE_URL="$ADMIN_DATABASE_URL" node --conditions development --import tsx \
 *     packages/ops-data/scripts/research-batch.ts --ids=id1,id2 --work-dir=<dir outside the repo> \
 *     --drafter-actor=<who wrote the text> --drafter-family=anthropic \
 *     [--preservation-decisions=<file>] [--max=10] [--apply]
 *
 * A record with a rejected claim is held (its rejection is still recorded); the rest continue.
 * shortcut: any refusal, missing verdict or blocked claim stops every record in the batch, not
 * just its own; split per record once batches are large enough for that to cost real work.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS, '../../..');
const KILL_SWITCH_ID = 'research-campaigns';
const REVIEWER = { actorId: 'codex-review:gpt-6.1-sol', family: 'openai' };

/** The first top-level JSON object in a step's stdout; steps print prose after their report. */
export function firstJson(stdout: string): Record<string, unknown> {
  const start = stdout.indexOf('{');
  for (
    let end = stdout.lastIndexOf('}');
    start >= 0 && end > start;
    end = stdout.lastIndexOf('}', end - 1)
  ) {
    try {
      return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      // keep shrinking until the slice is the report alone
    }
  }
  throw new Error('step printed no JSON report');
}

/** Entities whose every packet was approved; anything refused or unreviewed stops the batch. */
export function passingEntities(
  packetEntityIds: readonly string[],
  verdictCount: number,
  report: {
    approved?: { entityId: string }[];
    rejected?: { entityId: string }[];
    refused?: unknown[];
  },
): string[] {
  if (verdictCount !== packetEntityIds.length) {
    throw new Error(
      `${verdictCount} verdicts for ${packetEntityIds.length} packets; re-run the review`,
    );
  }
  if ((report.refused ?? []).length > 0) {
    throw new Error(
      `ledger refused ${(report.refused ?? []).length} verdicts: ${JSON.stringify(report.refused)}`,
    );
  }
  const rejected = new Set((report.rejected ?? []).map((row) => row.entityId));
  return [...new Set(packetEntityIds)].filter((id) => !rejected.has(id));
}

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback === undefined) throw new Error(`--${name}= is required`);
  return fallback;
}

function step(
  label: string,
  script: string,
  args: string[],
  env: Record<string, string> = {},
): string {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(
    process.execPath,
    ['--conditions', 'development', '--import', 'tsx', join(REPO_ROOT, script), ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) throw new Error(`${label} exited ${result.status}`);
  return result.stdout ?? '';
}

const jsonl = (path: string): Record<string, unknown>[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);

async function killSwitchEngaged(): Promise<boolean> {
  const client = new pg.Client(normalizePgConnectionString(process.env.DATABASE_URL ?? ''));
  await client.connect();
  try {
    const rows = await client.query('SELECT enabled FROM ops.kill_switches WHERE id = $1', [
      KILL_SWITCH_ID,
    ]);
    return rows.rows[0]?.enabled === true;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const ids = [
    ...new Set(
      flag('ids')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  const max = Number(flag('max', '10'));
  const workDir = resolve(flag('work-dir'));
  const drafter = [
    `--drafter-actor=${flag('drafter-actor')}`,
    `--drafter-family=${flag('drafter-family')}`,
  ];
  const decisions = flag('preservation-decisions', '');
  if (ids.length === 0 || ids.length > max)
    throw new Error(`${ids.length} ids; this run allows 1 to ${max}`);
  if (workDir.startsWith(REPO_ROOT)) throw new Error('--work-dir must be outside the repository');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (the admin login)');
  if (await killSwitchEngaged())
    throw new Error(`kill switch ${KILL_SWITCH_ID} is engaged; nothing run`);
  mkdirSync(join(workDir, 'codex'), { recursive: true });
  const S = 'packages/ops-data/scripts';
  const packets = join(workDir, 'packets.jsonl');
  const verdicts = join(workDir, 'verdicts.jsonl');

  if (apply && decisions) {
    step('capture', 'packages/operator-cli/src/bin.ts', [
      'capture-backfill',
      '--landscape-ids',
      ids.join(','),
      '--preservation-decisions',
      decisions,
      '--commit',
    ]);
  }

  step('claim packets', `${S}/session-claim-review-prepare.ts`, [
    `--entity-ids=${ids.join(',')}`,
    `--out=${packets}`,
  ]);
  const blocked = JSON.parse(readFileSync(join(workDir, 'packets.blocked.json'), 'utf8')) as {
    missingEntityIds: unknown[];
    blocked: unknown[];
  };
  if (blocked.blocked.length > 0 || blocked.missingEntityIds.length > 0) {
    throw new Error(
      `${blocked.blocked.length} claims have no reviewable capture and ${blocked.missingEntityIds.length} ids are missing; see packets.blocked.json`,
    );
  }
  const packetEntityIds = jsonl(packets).map((packet) => String(packet.entityId));
  if (packetEntityIds.length === 0) throw new Error('no claims to review');

  step('claim review (Sol)', `${S}/session-claim-review-codex.ts`, [
    `--packets-file=${packets}`,
    `--out=${verdicts}`,
    `--work-dir=${join(workDir, 'codex')}`,
  ]);
  const verdictCount = existsSync(verdicts) ? jsonl(verdicts).length : 0;
  const reviewerEnv = {
    CLAIM_REVIEW_REVIEWER_ACTOR_ID: REVIEWER.actorId,
    CLAIM_REVIEW_REVIEWER_MODEL_FAMILY: REVIEWER.family,
  };
  const ledgerArgs = [`--packets-file=${packets}`, `--verdicts-file=${verdicts}`];
  const dry = firstJson(
    step('ledger dry run', `${S}/session-claim-review-apply.ts`, ledgerArgs, {
      ...reviewerEnv,
      DRY_RUN: '1',
    }),
  );
  const passing = passingEntities(packetEntityIds, verdictCount, dry);
  const held = [...new Set(packetEntityIds)].filter((id) => !passing.includes(id));
  if (!apply) {
    console.log(
      `\nDry run: ${passing.length} records clear claim review, ${held.length} held (${held.join(', ') || 'none'}).`,
    );
    console.log(
      'Nothing written. Text review and publishing need the ledger, so they run only with --apply.',
    );
    return;
  }

  step('ledger write', `${S}/session-claim-review-apply.ts`, ledgerArgs, {
    ...reviewerEnv,
    DRY_RUN: '0',
    CLAIM_REVIEW_APPLY: '1',
  });
  if (passing.length === 0)
    throw new Error(`every record has a rejected claim; held: ${held.join(', ')}`);

  const idsFile = join(workDir, 'text-ids.txt');
  writeFileSync(idsFile, `${passing.join('\n')}\n`);
  const text = `${S}/session-public-text-review.ts`;
  step('text packets', text, ['--step=prepare', `--ids-file=${idsFile}`, `--work-dir=${workDir}`]);
  step('text review (Sol)', text, ['--step=review', `--work-dir=${workDir}`]);
  const textVerdicts = jsonl(join(workDir, 'text-verdicts.jsonl')).length;
  if (textVerdicts !== passing.length)
    throw new Error(`${textVerdicts} text verdicts for ${passing.length} records`);
  const applyText = ['--step=apply', `--work-dir=${workDir}`, ...drafter];
  const textDry = firstJson(step('text ledger dry run', text, applyText, { DRY_RUN: '1' })) as {
    approved?: string[];
    refused?: unknown[];
  };
  if ((textDry.refused ?? []).length > 0)
    throw new Error(`text ledger refused: ${JSON.stringify(textDry.refused)}`);
  step('text ledger write', text, applyText, { DRY_RUN: '0', PUBLIC_TEXT_REVIEW_APPLY: '1' });
  const approved = textDry.approved ?? [];
  if (approved.length === 0) throw new Error('no record passed text review; nothing to publish');

  const publisher = `${S}/publish-release-entities-incremental.ts`;
  const publishArgs = [`--ids=${approved.join(',')}`];
  const eligible = /^Eligible: (\d+)$/mu.exec(
    step('publisher dry run', publisher, publishArgs, { DRY_RUN: '1' }),
  );
  if (Number(eligible?.[1]) !== approved.length) {
    throw new Error(
      `publisher finds ${eligible?.[1] ?? 'no'} of ${approved.length} eligible; nothing published`,
    );
  }
  step('publish', publisher, publishArgs, { DRY_RUN: '0', INCREMENTAL_PUBLISH_APPLY: '1' });

  // Local uploads over about 5 MB are cut off on this machine, so the workflow republishes.
  console.log('\n== catalog republish ==');
  const dispatch = spawnSync(
    'gh',
    [
      'workflow',
      'run',
      'publish-release-catalog-artifacts.yml',
      '--ref',
      'main',
      '-f',
      'force=true',
    ],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  console.log(
    `\nPublished ${approved.length}: ${approved.join(', ')}. Held: ${[...held, ...passing.filter((id) => !approved.includes(id))].join(', ') || 'none'}.`,
  );
  if (dispatch.status !== 0)
    throw new Error('records are published but the catalog workflow was not dispatched; run it');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nSTOPPED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
