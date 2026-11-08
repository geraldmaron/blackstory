/**
 * Review the exact text a new record will publish, against its claims and captured sources.
 *
 *   --step=prepare   build packets from the database (read only)
 *   --step=review    send each packet to Sol through Codex (DATA LEAVES THIS MACHINE: the record's
 *                    text, claims and captured public source text go to OpenAI; no database access)
 *   --step=apply     validate verdicts and record them; dry run unless DRY_RUN=0 PUBLIC_TEXT_REVIEW_APPLY=1
 *
 * Usage (from repo root, after sourcing apps/web/.env.local and exporting DATABASE_SSL=1):
 *   node --conditions development --import tsx packages/ops-data/scripts/session-public-text-review.ts \
 *     --step=prepare --ids-file=<ids> --work-dir=<dir outside the repo> [--rejected-file=<json>]
 *   ... --step=review --work-dir=<dir> [--model=gpt-6.1-sol]
 *   ... --step=apply --work-dir=<dir> --drafter-actor=<who actually wrote this text> --drafter-family=<model family>
 *
 * The drafter flags state the real author of the current text. They are required on apply because
 * a landscape row's metadata names whoever first produced the row, not whoever wrote this revision.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { buildReleaseSourceFromLandscape } from './lib/incremental-publish.ts';
import { loadReviewClaims, recordDecision } from './lib/claim-review-ledger.ts';
import {
  PUBLIC_TEXT_OUTPUT_SCHEMA,
  PUBLIC_TEXT_REVIEW_ARTIFACT,
  buildPublicTextPrompt,
  providerOf,
  publicTextHash,
  validatePublicTextVerdict,
  type PublicTextPacket,
  type PublicTextVerdict,
} from './lib/public-text-review.ts';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback === undefined) throw new Error(`--${name}= is required`);
  return fallback;
}

const workDir = resolve(flag('work-dir'));
if (workDir === REPO_ROOT || workDir.startsWith(`${REPO_ROOT}/`)) {
  throw new Error('--work-dir must be outside the repository so the reviewer cannot read it');
}
const packetsPath = join(workDir, 'text-packets.jsonl');
const verdictsPath = join(workDir, 'text-verdicts.jsonl');

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);

async function withDb<T>(run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    return await run(client);
  } finally {
    client.release();
    await pool.end();
  }
}

/** Current packets, always rebuilt from the database so apply never trusts a file. */
async function buildPackets(
  client: pg.PoolClient,
  ids: readonly string[],
  rejectedFile: Record<string, { object: string }[]>,
): Promise<{ packets: PublicTextPacket[]; rows: Map<string, unknown>; blocked: unknown[] }> {
  const { prepared, blocked } = await loadReviewClaims(client, ids);
  const rejectedInLedger = await client.query<{ uri: string; object: string }>(
    `SELECT a.storage_uri AS uri, f->>'object' AS object
     FROM research.artifacts a
     JOIN research.review_decisions r ON r.artifact_id = a.id AND r.decision = 'reject'
     CROSS JOIN LATERAL jsonb_array_elements(r.findings) f
     WHERE a.storage_uri = ANY($1::text[]) AND f ? 'object'`,
    [ids.map((id) => `landscape://${id}`)],
  );
  const packets: PublicTextPacket[] = [];
  const rows = new Map<string, unknown>();
  for (const id of new Set(prepared.map((claim) => claim.packet.entityId))) {
    const claims = prepared.filter((claim) => claim.packet.entityId === id);
    const entry = buildReleaseSourceFromLandscape(claims[0]!.row);
    if (!entry) continue;
    rows.set(id, claims[0]!.row);
    const sources = new Map(claims.map((claim) => [claim.claim.citationHref, claim.capture.text]));
    const rejected = new Set([
      ...(rejectedFile[id] ?? []).map((fact) => fact.object),
      ...rejectedInLedger.rows.filter((r) => r.uri === `landscape://${id}`).map((r) => r.object),
    ]);
    packets.push({
      entityId: id,
      displayName: entry.displayName,
      textHash: publicTextHash(entry),
      text: {
        summary: entry.summary,
        ...(entry.historicalContext ? { historicalContext: entry.historicalContext } : {}),
        ...(entry.impactStatement ? { impactStatement: entry.impactStatement } : {}),
      },
      claims: claims.map((claim, index) => ({
        ref: `C${index + 1}`,
        object: claim.claim.object,
        citationHref: claim.claim.citationHref,
      })),
      sources: [...sources].map(([url, text]) => ({ url, text })),
      rejectedFacts: [...rejected],
    });
  }
  return { packets, rows, blocked };
}

async function prepare(): Promise<void> {
  const ids = readFileSync(flag('ids-file'), 'utf8').trim().split(/[\s,]+/u);
  const rejectedPath = flag('rejected-file', '');
  const rejected = rejectedPath ? JSON.parse(readFileSync(rejectedPath, 'utf8')) : {};
  mkdirSync(workDir, { recursive: true });
  const { packets, blocked } = await withDb((client) => buildPackets(client, ids, rejected));
  writeFileSync(packetsPath, `${packets.map((p) => JSON.stringify(p)).join('\n')}\n`);
  console.log(`Packets: ${packets.length} of ${ids.length}; blocked claims: ${blocked.length}`);
  if (blocked.length > 0) console.log(JSON.stringify(blocked, null, 1));
}

function review(): void {
  const model = flag('model', 'gpt-6.1-sol');
  const packets = readJsonl<PublicTextPacket>(packetsPath);
  const schemaPath = join(workDir, 'text-schema.json');
  writeFileSync(schemaPath, JSON.stringify(PUBLIC_TEXT_OUTPUT_SCHEMA));
  const lines: string[] = [];
  for (const packet of packets) {
    const output = join(workDir, `text-${packet.entityId}.json`);
    if (existsSync(output)) rmSync(output);
    const result = spawnSync(
      'codex',
      [
        'exec', '-m', model, '-s', 'read-only', '--skip-git-repo-check', '--ephemeral',
        '-C', workDir, '--output-schema', schemaPath, '-o', output, '-',
      ],
      // Stdin closes after the prompt; an open stdin makes codex wait forever.
      {
        cwd: workDir,
        input: buildPublicTextPrompt(packet),
        encoding: 'utf8',
        timeout: 20 * 60_000,
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (result.status !== 0 || !existsSync(output)) {
      console.error(`${packet.entityId}: codex failed; no verdict`);
      continue;
    }
    const verdict = JSON.parse(readFileSync(output, 'utf8')) as PublicTextVerdict;
    lines.push(JSON.stringify({ entityId: packet.entityId, textHash: packet.textHash, reviewerActorId: `codex-review:${model}`, verdict }));
    console.log(`${packet.entityId}: ${verdict.decision}`);
  }
  writeFileSync(verdictsPath, `${lines.join('\n')}\n`);
}

type VerdictLine = {
  entityId: string;
  textHash: string;
  reviewerActorId: string;
  verdict: PublicTextVerdict;
};

async function apply(): Promise<void> {
  const write = process.env.DRY_RUN === '0' && process.env.PUBLIC_TEXT_REVIEW_APPLY === '1';
  const drafter = { actorId: flag('drafter-actor'), modelFamily: flag('drafter-family') };
  const reviewerFamily = flag('reviewer-family', 'openai');
  if (!providerOf(drafter.modelFamily) || providerOf(drafter.modelFamily) === providerOf(reviewerFamily)) {
    throw new Error('Drafter and reviewer must be known, different providers');
  }
  const lines = readJsonl<VerdictLine>(verdictsPath);
  const ids = lines.map((line) => line.entityId);
  await withDb(async (client) => {
    await client.query(write ? 'BEGIN' : 'BEGIN READ ONLY');
    try {
      if (write) await client.query('SET LOCAL ROLE service_role');
      const { packets, rows } = await buildPackets(client, ids, {});
      const stored = new Map(readJsonl<PublicTextPacket>(packetsPath).map((p) => [p.entityId, p]));
      const profiles = (await client.query(`SELECT id, version FROM research.research_profiles WHERE active`)).rows;
      if (profiles.length !== 1) throw new Error(`Expected one active research profile, found ${profiles.length}`);
      const report = { approved: [] as string[], changesRequested: [] as unknown[], refused: [] as unknown[] };
      for (const line of lines) {
        const current = packets.find((packet) => packet.entityId === line.entityId);
        const reviewed = stored.get(line.entityId);
        if (!current || !reviewed || current.textHash !== line.textHash) {
          report.refused.push({ entityId: line.entityId, errors: ['text or claims changed since review'] });
          continue;
        }
        // Validate against the packet the reviewer actually saw, which also holds the rejected facts.
        const result = validatePublicTextVerdict(reviewed, line.verdict);
        if (!result.ok) {
          report.refused.push({ entityId: line.entityId, errors: result.errors });
          continue;
        }
        const approved = line.verdict.decision === 'approve';
        if (approved) report.approved.push(line.entityId);
        else report.changesRequested.push({ entityId: line.entityId, findings: line.verdict.findings });
        if (!write) continue;
        await recordDecision(client, {
          first: {
            row: rows.get(line.entityId) as never,
            producer: { actorId: drafter.actorId, actorType: 'model', modelFamily: drafter.modelFamily },
          },
          decision: approved ? 'approve' : 'reject',
          claimVersionIds: [],
          findings: line.verdict.findings.map((finding) => ({ finding, textHash: line.textHash })),
          reviewer: { actorId: line.reviewerActorId, modelFamily: reviewerFamily },
          profile: { id: String(profiles[0]!.id), version: String(profiles[0]!.version) },
          artifact: {
            type: PUBLIC_TEXT_REVIEW_ARTIFACT,
            schemaId: 'PublicTextReview',
            contentHash: line.textHash,
            extensions: { entityId: line.entityId, clauses: line.verdict.clauses },
            independenceBasis:
              `Reviewer ${line.reviewerActorId} (${reviewerFamily}) reviewed the exact public text ` +
              `drafted by ${drafter.actorId} (${drafter.modelFamily}) against the record's claims ` +
              'and stored capture text. It tests support in those sources, not historical truth.',
          },
        });
      }
      await client.query(write ? 'COMMIT' : 'ROLLBACK');
      console.log(JSON.stringify({ mode: write ? 'applied' : 'dry-run', ...report }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

const step = flag('step');
const done = step === 'prepare' ? prepare() : step === 'apply' ? apply() : Promise.resolve(review());
done.catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
