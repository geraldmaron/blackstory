/**
 * Independent claim review by a different vendor's model: Sol via the Codex CLI (OpenAI).
 *
 * DATA LEAVES THIS MACHINE: each call sends the packet's record name, claim text and the captured
 * public source text to OpenAI through `codex exec`. Nothing else is sent: no repository, no
 * producer prompt or reasoning. Calls use the operator's Codex account and may be billed there.
 *
 * Reads packets.jsonl from session-claim-review-prepare.ts and writes verdicts.jsonl for
 * session-claim-review-apply.ts. The model's answer is never trusted on its own: apply rechecks
 * every packetHash against the database and every quote verbatim against the stored capture.
 * Codex runs read-only in an empty scratch directory outside the repository, with a strict
 * output schema, one small batch per call, stdin closed after the prompt.
 *
 * Usage (from repo root; no database access needed):
 *   node --conditions development --import tsx packages/ops-data/scripts/session-claim-review-codex.ts \
 *     --packets-file=<dir>/packets.jsonl --out=<dir>/verdicts.jsonl --work-dir=<empty scratch dir>
 * Optional: --model=gpt-6.1-sol (default) --batch-size=3 --max-prompt-chars=300000 --concurrency=4
 * Batches run --concurrency at a time; verdicts are written in packet order either way.
 * Then apply with CLAIM_REVIEW_REVIEWER_ACTOR_ID=codex-review:<model> CLAIM_REVIEW_REVIEWER_MODEL_FAMILY=openai.
 */
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPool } from '../../operator-cli/src/map-pool.ts';
import { runCodexExec } from './lib/codex-exec.ts';
import {
  REVIEWER_OUTPUT_SCHEMA,
  buildReviewerPrompt,
  parseReviewerVerdicts,
  type ReviewPacket,
  type Verdict,
} from './lib/claim-review-ledger.ts';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback === undefined) throw new Error(`--${name}= is required`);
  return fallback;
}

function batches(packets: readonly ReviewPacket[], size: number, maxChars: number) {
  const out: ReviewPacket[][] = [];
  let current: ReviewPacket[] = [];
  let chars = 0;
  for (const packet of packets) {
    const length = packet.sourceText.length + packet.claim.object.length;
    if (current.length > 0 && (current.length >= size || chars + length > maxChars)) {
      out.push(current);
      current = [];
      chars = 0;
    }
    current.push(packet);
    chars += length;
  }
  if (current.length > 0) out.push(current);
  return out;
}

async function main(): Promise<void> {
  const packets = readFileSync(flag('packets-file'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ReviewPacket);
  const out = flag('out');
  const workDir = resolve(flag('work-dir'));
  const model = flag('model', 'gpt-6.1-sol');
  const size = Number(flag('batch-size', '3'));
  const maxChars = Number(flag('max-prompt-chars', '300000'));
  if (workDir === REPO_ROOT || workDir.startsWith(`${REPO_ROOT}/`)) {
    throw new Error('--work-dir must be outside the repository so the reviewer cannot read it');
  }
  mkdirSync(workDir, { recursive: true });
  const reviewerActorId = `codex-review:${model}`;
  const schemaPath = join(workDir, 'verdict-schema.json');
  writeFileSync(schemaPath, JSON.stringify(REVIEWER_OUTPUT_SCHEMA));

  const concurrency = Number(flag('concurrency', '4'));
  const planned = batches(packets, size, maxChars);
  // Each batch is appended as it lands, so a crash mid-run keeps the verdicts already paid for;
  // the file is rewritten in packet order at the end.
  writeFileSync(out, '');
  const results = await mapPool(
    planned,
    async (batch, index) => {
      const outputPath = join(workDir, `batch-${index + 1}.json`);
      if (existsSync(outputPath)) rmSync(outputPath);
      const result = await runCodexExec({
        model,
        workDir,
        schemaPath,
        outputPath,
        prompt: buildReviewerPrompt(batch),
        timeoutMs: 20 * 60_000,
      });
      if (result.status !== 0 || !existsSync(outputPath)) {
        console.error(
          `batch ${index + 1}: codex failed (status ${result.status}); ${result.stderr.slice(-400)}`,
        );
        return { verdicts: [] as Verdict[], missing: batch.map((packet) => packet.packetId) };
      }
      try {
        const parsed = parseReviewerVerdicts(
          readFileSync(outputPath, 'utf8'),
          batch,
          reviewerActorId,
        );
        if (parsed.verdicts.length > 0) {
          appendFileSync(
            out,
            parsed.verdicts.map((verdict) => `${JSON.stringify(verdict)}\n`).join(''),
          );
        }
        console.log(
          `batch ${index + 1}: ${parsed.verdicts.length}/${batch.length} verdicts, ${parsed.ignored} ignored`,
        );
        return { verdicts: [...parsed.verdicts], missing: [...parsed.missing] };
      } catch (error) {
        console.error(`batch ${index + 1}: unparseable reviewer output (${String(error)})`);
        return { verdicts: [] as Verdict[], missing: batch.map((packet) => packet.packetId) };
      }
    },
    { concurrency },
  );
  const verdicts = results.flatMap((result) => result.verdicts);
  const missing = results.flatMap((result) => result.missing);
  writeFileSync(
    out,
    verdicts.map((verdict) => JSON.stringify(verdict)).join('\n') + (verdicts.length ? '\n' : ''),
  );
  console.log(`Verdicts: ${verdicts.length} -> ${out}`);
  console.log(
    `  approve: ${verdicts.filter((v) => v.decision === 'approve').length}, reject: ${verdicts.filter((v) => v.decision === 'reject').length}`,
  );
  if (missing.length > 0) console.log(`No verdict (re-run these): ${missing.join(', ')}`);
  console.log(
    `Apply with CLAIM_REVIEW_REVIEWER_ACTOR_ID=${reviewerActorId} CLAIM_REVIEW_REVIEWER_MODEL_FAMILY=openai`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
