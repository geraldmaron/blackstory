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
 *     [--preservation-decisions=<file>] [--max=10] [--apply] [--correct]
 *
 * --correct changes records that are already live, in place, after the same review.
 * Captures use the standing rule below plus any decisions passed in; a source with neither stays
 * uncaptured and blocks its claims. RESEARCH_RUN_LOG=<file> appends one JSON line per run.
 *
 * A blocked claim, a missing verdict, a ledger refusal or a rejected claim holds that record
 * alone, and so does a record the publisher's own gates skip.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { lookupSourceRegisterByUrl } from './lib/source-register.ts';
import { isReputableSecondaryHost, isTier1Host, isWikipediaHost } from './lib/tier1-sources.ts';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS, '../../..');
const KILL_SWITCH_ID = 'research-campaigns';
const REVIEWER = { actorId: 'codex-review:gpt-6.1-sol', family: 'openai' };

/**
 * Standing capture rule (owner, 2026-11-25): a page from a publisher the pipeline recognizes may
 * be kept as a private text copy for one year so review can check claims against it; it is never
 * publicly archived. Wikipedia and unrecognized hosts get no decision, so their claims stay
 * blocked until the owner decides.
 */
export function standingDecisions(urls: readonly string[], now: Date): Record<string, unknown>[] {
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return [...new Set(urls)]
    .filter(
      (url) =>
        !isWikipediaHost(url) &&
        (isTier1Host(url) ||
          isReputableSecondaryHost(url) ||
          lookupSourceRegisterByUrl(url) !== undefined),
    )
    .map((sourceUrl) => ({
      sourceUrl,
      allowTextRetention: true,
      allowArchive: false,
      sensitivity: 'public',
      reviewedBy: 'standing rule (owner, 2026-11-25)',
      reviewedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      basis:
        'Private evidence copy from a recognized publisher, kept only so claim review can check each claim against its source; never republished or publicly archived.',
    }));
}

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

/** The ids the publisher's dry run lists as eligible, limited to the ones that were asked for. */
export function eligibleIds(dryRunOutput: string, asked: readonly string[]): string[] {
  const listed = new Set(
    [...dryRunOutput.matchAll(/^ {2}(\S+) \(basis=[^)]*\)$/gmu)].map((match) => match[1]),
  );
  return asked.filter((id) => listed.has(id));
}

/**
 * Which records clear claim review, and why each of the others is held. A record is held, alone,
 * when one of its claims is blocked, unreviewed, refused by the ledger or rejected; the rest of
 * the batch goes on.
 */
export function passingEntities(
  packets: readonly { packetId: string; entityId: string }[],
  verdictPacketIds: readonly string[],
  report: { rejected?: { entityId: string }[]; refused?: { packetId: string }[] },
  blockedEntityIds: readonly string[] = [],
): { passing: string[]; held: Record<string, string> } {
  const entityOf = new Map(packets.map((packet) => [packet.packetId, packet.entityId]));
  const reviewed = new Set(verdictPacketIds);
  const held: Record<string, string> = {};
  const hold = (entityId: string | undefined, reason: string): void => {
    if (entityId !== undefined && held[entityId] === undefined) held[entityId] = reason;
  };
  for (const entityId of blockedEntityIds) hold(entityId, 'a claim has no reviewable capture');
  for (const packet of packets) {
    if (!reviewed.has(packet.packetId)) hold(packet.entityId, 'a claim got no verdict');
  }
  for (const refusal of report.refused ?? []) {
    hold(entityOf.get(refusal.packetId), 'the ledger refused a verdict');
  }
  for (const rejection of report.rejected ?? []) hold(rejection.entityId, 'a claim was rejected');
  const all = [...new Set([...packets.map((packet) => packet.entityId), ...blockedEntityIds])];
  return { passing: all.filter((id) => held[id] === undefined), held };
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

async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
  const client = new pg.Client(normalizePgConnectionString(process.env.DATABASE_URL ?? ''));
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

// Same citation fields capture-backfill reads for --landscape-ids.
const CITED_URLS_SQL = `
  SELECT DISTINCT btrim(cited.url) AS url
  FROM research.landscape_candidates lc
  CROSS JOIN LATERAL (
    SELECT lc.canonical_url AS url
    UNION ALL
    SELECT lc.payload->>'registrySourceUrl'
    UNION ALL
    SELECT citation->>'sourceUrl' FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(lc.payload->'evidenceCitations') = 'array'
        THEN lc.payload->'evidenceCitations' ELSE '[]'::jsonb END) citation
    UNION ALL
    SELECT claim->>'citationHref' FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(lc.payload->'summaryClaims') = 'array'
        THEN lc.payload->'summaryClaims' ELSE '[]'::jsonb END) claim
  ) cited
  WHERE lc.id = ANY($1::text[]) AND nullif(btrim(cited.url), '') IS NOT NULL`;

/** What a run did, for the run log. Filled as the run goes so a stopped run still reports. */
const log: Record<string, unknown> = {};

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
  const correct = process.argv.includes('--correct');
  Object.assign(log, { startedAt: new Date().toISOString(), apply, correct, attempted: ids });
  const switches = await query<{ enabled: boolean }>(
    'SELECT enabled FROM ops.kill_switches WHERE id = $1',
    [KILL_SWITCH_ID],
  );
  if (switches[0]?.enabled === true)
    throw new Error(`kill switch ${KILL_SWITCH_ID} is engaged; nothing run`);
  mkdirSync(join(workDir, 'codex'), { recursive: true });
  const S = 'packages/ops-data/scripts';
  const packets = join(workDir, 'packets.jsonl');
  const verdicts = join(workDir, 'verdicts.jsonl');

  if (apply) {
    const cited = (await query<{ url: string }>(CITED_URLS_SQL, [ids])).map((row) => row.url);
    const explicit = decisions
      ? (JSON.parse(readFileSync(decisions, 'utf8')) as Record<string, unknown>[])
      : [];
    const decided = new Set(explicit.map((decision) => String(decision.sourceUrl)));
    const standing = standingDecisions(
      cited.filter((url) => !decided.has(url)),
      new Date(),
    );
    const undecided = cited.filter(
      (url) => !decided.has(url) && !standing.some((decision) => decision.sourceUrl === url),
    );
    if (undecided.length > 0) console.log(`No capture decision for: ${undecided.join(', ')}`);
    log.undecidedSources = undecided;
    const decisionsFile = join(workDir, 'preservation-decisions.json');
    writeFileSync(decisionsFile, JSON.stringify([...explicit, ...standing], null, 2));
    step('capture', 'packages/operator-cli/src/bin.ts', [
      'capture-backfill',
      '--landscape-ids',
      ids.join(','),
      '--preservation-decisions',
      decisionsFile,
      '--commit',
    ]);
  }

  step('claim packets', `${S}/session-claim-review-prepare.ts`, [
    `--entity-ids=${ids.join(',')}`,
    `--out=${packets}`,
  ]);
  const blocked = JSON.parse(readFileSync(join(workDir, 'packets.blocked.json'), 'utf8')) as {
    missingEntityIds: string[];
    blocked: { entityId: string }[];
  };
  const blockedEntityIds = [
    ...new Set([...blocked.missingEntityIds, ...blocked.blocked.map((claim) => claim.entityId)]),
  ];
  const packetList = jsonl(packets).map((packet) => ({
    packetId: String(packet.packetId),
    entityId: String(packet.entityId),
  }));
  if (packetList.length === 0) throw new Error('no claims to review; see packets.blocked.json');

  step('claim review (Sol)', `${S}/session-claim-review-codex.ts`, [
    `--packets-file=${packets}`,
    `--out=${verdicts}`,
    `--work-dir=${join(workDir, 'codex')}`,
  ]);
  const verdictPacketIds = existsSync(verdicts)
    ? jsonl(verdicts).map((verdict) => String(verdict.packetId))
    : [];
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
  const { passing, held: heldWhy } = passingEntities(
    packetList,
    verdictPacketIds,
    dry as { rejected?: { entityId: string }[]; refused?: { packetId: string }[] },
    blockedEntityIds,
  );
  const held = Object.keys(heldWhy);
  for (const [id, why] of Object.entries(heldWhy)) console.log(`Held ${id}: ${why}`);
  Object.assign(log, {
    packets: packetList.length,
    claimsApproved: ((dry.approved as unknown[]) ?? []).length,
    claimsRejected: ((dry.rejected as unknown[]) ?? []).length,
    clearedClaimReview: passing,
    heldAtClaimReview: heldWhy,
  });
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
    throw new Error(`no record cleared claim review; held: ${held.join(', ')}`);

  const idsFile = join(workDir, 'text-ids.txt');
  writeFileSync(idsFile, `${passing.join('\n')}\n`);
  const text = `${S}/session-public-text-review.ts`;
  step('text packets', text, ['--step=prepare', `--ids-file=${idsFile}`, `--work-dir=${workDir}`]);
  step('text review (Sol)', text, ['--step=review', `--work-dir=${workDir}`]);
  const applyText = ['--step=apply', `--work-dir=${workDir}`, ...drafter];
  const textDry = firstJson(step('text ledger dry run', text, applyText, { DRY_RUN: '1' })) as {
    approved?: string[];
    refused?: unknown[];
  };
  // A record with no text verdict, a refused one or requested changes is simply not in `approved`.
  if ((textDry.refused ?? []).length > 0)
    console.log(`Text ledger refused: ${JSON.stringify(textDry.refused)}`);
  step('text ledger write', text, applyText, { DRY_RUN: '0', PUBLIC_TEXT_REVIEW_APPLY: '1' });
  const approved = textDry.approved ?? [];
  log.clearedTextReview = approved;
  if (approved.length === 0) throw new Error('no record passed text review; nothing to publish');

  const publisher = `${S}/publish-release-entities-incremental.ts`;
  const correction = correct ? ['--republish', '--correct'] : [];
  // The publisher has gates of its own (carried live claims, depth, privacy). What it skips is
  // held with the rest; what it finds eligible ships.
  const dryPublish = step(
    'publisher dry run',
    publisher,
    [`--ids=${approved.join(',')}`, ...correction],
    { DRY_RUN: '1' },
  );
  const eligible = eligibleIds(dryPublish, approved);
  const skipped = approved.filter((id) => !eligible.includes(id));
  if (skipped.length > 0) console.log(`Held by the publisher: ${skipped.join(', ')}`);
  log.heldAtPublisher = skipped;
  if (eligible.length === 0) throw new Error('the publisher finds no record eligible');
  const publishArgs = [`--ids=${eligible.join(',')}`, ...correction];
  step('publish', publisher, publishArgs, { DRY_RUN: '0', INCREMENTAL_PUBLISH_APPLY: '1' });
  log.published = eligible;

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
    `\nPublished ${eligible.length}: ${eligible.join(', ')}. Held: ${[...held, ...passing.filter((id) => !eligible.includes(id))].join(', ') || 'none'}.`,
  );
  if (correct) {
    console.log(
      'Live records changed: purge the Cloudflare zone (docs/security/cost-resource-controls.md).',
    );
  }
  if (dispatch.status !== 0)
    throw new Error('records are published but the catalog workflow was not dispatched; run it');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      log.stopped = error instanceof Error ? error.message : String(error);
      console.error(`\nSTOPPED: ${String(log.stopped)}`);
      process.exitCode = 1;
    })
    .finally(() => {
      // One line per run; RESEARCH_RUN_LOG names the file. Counts need the attempted denominator.
      const path = process.env.RESEARCH_RUN_LOG;
      if (path)
        appendFileSync(path, `${JSON.stringify({ ...log, endedAt: new Date().toISOString() })}\n`);
    });
}
