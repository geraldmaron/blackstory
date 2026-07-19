/**
 * Commit solid enrichment keeps from a prior enrichment-run JSON file to quarantine only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EditorialPacket } from '@repo/domain';
import { createServerFirebaseApp } from '@repo/firebase';
import { createAdminAtomicStore } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';
import { commitOperatorIntake } from '../../operator-cli/src/commit.js';
import { prepareEditorialPacketIntake } from '../../operator-cli/src/editorial-intake.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_RUN_PATH = join(ROOT, '.cache/corsair-triage/enrichment-run.json');
const OUT_PATH = join(ROOT, '.cache/corsair-triage/enrichment-commit-summary.json');

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

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const runPath = runPathFromArgv(process.argv);
  const run = JSON.parse(readFileSync(runPath, 'utf8')) as RunFile;
  const solidKeeps = run.items
    .map((item) => item.packet)
    .filter(
      (packet) =>
        packet.decision === 'keep' &&
        packet.confidence >= 0.6 &&
        (packet.validationIssues?.length ?? 0) === 0,
    );

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry_run',
          runPath,
          solidKeepCount: solidKeeps.length,
          sampleTitles: solidKeeps.slice(0, 5).map((packet) => packet.subjectTitle),
        },
        null,
        2,
      ),
    );
    return;
  }

  const { app } = createServerFirebaseApp(process.env);
  const store = createAdminAtomicStore(getFirestore(app));
  const context = {
    identity: {
      operatorId: 'corsair-triage-agent',
      sessionId: `corsair-triage-commit-${Date.now()}`,
      source: 'cli' as const,
    },
    privacyPepper:
      process.env.OPERATOR_CLI_PRIVACY_PEPPER ?? 'dev-preview-pepper-not-for-production',
  };

  let committed = 0;
  let failed = 0;
  const errors: { readonly subjectId: string; readonly error: string }[] = [];

  for (const packet of solidKeeps) {
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
    solidKeepCount: solidKeeps.length,
    committed,
    failed,
    errors,
  };
  const outPath =
    runPath === DEFAULT_RUN_PATH
      ? OUT_PATH
      : join(ROOT, '.cache/corsair-triage/enrichment-commit-summary-round2.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, outPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
