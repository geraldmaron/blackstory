/**
 * Commit live DC enrichment packets (keep + needs_evidence) from enrichment-run JSON
 * into bb_submissions quarantine via Postgres commitWithAudit. Never writes bb_public.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EditorialPacket } from '@repo/domain';
import { createPostgresAtomicStore } from '../../data-access/src/postgres/atomic-store.js';
import { assertPostgresOpsDataSource } from '../../operator-cli/src/ops-data-source-gate.js';
import { commitOperatorIntake } from '../../operator-cli/src/commit.js';
import { prepareEditorialPacketIntake } from '../../operator-cli/src/editorial-intake.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_RUN_PATH = join(ROOT, '.cache/dc-enrichment/enrichment-run-live.json');
const DEFAULT_OUT_PATH = join(ROOT, '.cache/dc-enrichment/enrichment-commit-summary.json');

type RunFile = {
  readonly items: readonly {
    readonly packet: EditorialPacket;
  }[];
};

function runPathFromArgv(argv: readonly string[]): string {
  const flag = argv.find((arg) => arg.startsWith('--run='));
  if (flag) return flag.slice('--run='.length);
  const idx = argv.indexOf('--run');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return DEFAULT_RUN_PATH;
}

function outPathFromRun(runPath: string): string {
  if (runPath === DEFAULT_RUN_PATH) return DEFAULT_OUT_PATH;
  const base = runPath.replace(/\.json$/u, '');
  return `${base}-commit-summary.json`;
}

async function main(): Promise<void> {
  assertPostgresOpsDataSource(process.env);
  const apply = process.argv.includes('--apply');
  const runPath = runPathFromArgv(process.argv);
  const run = JSON.parse(readFileSync(runPath, 'utf8')) as RunFile;
  const commitPackets = run.items
    .map((item) => item.packet)
    .filter((packet) => packet.decision !== 'reject');

  if (!apply) {
    const byDecision = commitPackets.reduce<Record<string, number>>((acc, packet) => {
      acc[packet.decision] = (acc[packet.decision] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      JSON.stringify(
        {
          mode: 'dry_run',
          runPath,
          commitCount: commitPackets.length,
          byDecision,
          sampleTitles: commitPackets.slice(0, 5).map((packet) => packet.subjectTitle),
        },
        null,
        2,
      ),
    );
    return;
  }

  const store = createPostgresAtomicStore();
  const context = {
    identity: {
      operatorId: 'cursor-enrichment',
      sessionId: `dc-enrichment-commit-${Date.now()}`,
      source: 'cli' as const,
    },
    privacyPepper:
      process.env.OPERATOR_CLI_PRIVACY_PEPPER ?? 'dev-preview-pepper-not-for-production',
  };

  let committed = 0;
  let failed = 0;
  const errors: { readonly subjectId: string; readonly error: string }[] = [];

  for (const packet of commitPackets) {
    try {
      const outcome = prepareEditorialPacketIntake(packet, context);
      if (!outcome.accepted) {
        failed += 1;
        errors.push({
          subjectId: packet.subjectId,
          error: outcome.rejection.issues.map((issue) => issue.message).join('; ') || 'rejected',
        });
        continue;
      }
      await commitOperatorIntake(store, outcome);
      committed += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        subjectId: packet.subjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    mode: 'apply',
    runPath,
    commitCount: commitPackets.length,
    committed,
    failed,
    errors,
  };
  const outPath = outPathFromRun(runPath);
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, outPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
