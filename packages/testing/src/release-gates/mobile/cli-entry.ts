/**
 * CLI for the mobile store release gate.
 *
 *   collect   Read the generated native artifacts on a build host into an evidence bundle.
 *   evaluate  Judge an evidence bundle and write a GO / NO_GO decision artifact.
 *
 * Split so the two halves can run on different machines: collection needs macOS, Xcode, a JDK and
 * the Android SDK; evaluation needs none of them and runs wherever the bundle is carried.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHumanAttestationBundle } from '../../launch-gate/artifact.js';
import { collectMobileReleaseEvidence } from './collect.js';
import { evaluateMobileReleaseGate } from './evaluate.js';
import type { AppVariant, MobileReleaseEvidence } from './types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

const VARIANTS: readonly AppVariant[] = ['development', 'preview', 'production'];

function resolvePath(value: string): string {
  return isAbsolute(value) ? value : join(repoRoot, value);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function printHelp(): void {
  console.log(`Usage: mobile-release-gate <collect|evaluate> [options]

collect
  --variant <name>        development | preview | production (default: production)
  --collected-by <name>   Required. Operator or CI identity that ran the collection.
  --output <path>         Evidence bundle path (default: artifacts/mobile-release/evidence.json)
  --gradle-output <path>  Reuse captured \`./gradlew :app:properties\` stdout instead of running it
  --aapt-output <path>    Reuse captured \`aapt2 dump badging\` stdout instead of running it
  --apk <path>            Release artifact the badging above describes
  --skip-android          Omit Android evidence (the Android gate then fails, by design)

evaluate
  --evidence <path>       Required. Evidence bundle written by collect.
  --evaluator <name>      Required. Operator or CI identity recording the decision.
  --attestations <path>   JSON bundle of human attestations (fail-closed when omitted)
  --output <path>         Decision artifact (default: artifacts/mobile-release/decision.json)
  --json                  Print the full report to stdout
`);
}

interface ParsedArgs {
  readonly command: string;
  readonly flags: Readonly<Record<string, string | true>>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [, , command = '', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] ?? '';
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

function requireString(flags: ParsedArgs['flags'], key: string): string {
  const value = flags[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`--${key} is required.`);
  }
  return value;
}

function runCollect(flags: ParsedArgs['flags']): number {
  const variant = (flags.variant ?? 'production') as AppVariant;
  if (!VARIANTS.includes(variant)) {
    throw new Error(`--variant must be one of ${VARIANTS.join(', ')}.`);
  }
  const outputPath = resolvePath(
    typeof flags.output === 'string' ? flags.output : 'artifacts/mobile-release/evidence.json',
  );
  const evidence = collectMobileReleaseEvidence({
    repoRoot,
    variant,
    collectedBy: requireString(flags, 'collected-by'),
    android:
      flags['skip-android'] === true
        ? false
        : {
            ...(typeof flags['gradle-output'] === 'string'
              ? { gradleOutputPath: resolvePath(flags['gradle-output']) }
              : {}),
            ...(typeof flags['aapt-output'] === 'string'
              ? { aaptOutputPath: resolvePath(flags['aapt-output']) }
              : {}),
            ...(typeof flags.apk === 'string' ? { apkPath: resolvePath(flags.apk) } : {}),
          },
  });
  writeJson(outputPath, evidence);
  console.log(`Collected ${variant} evidence at ${evidence.commit.sha}`);
  console.log(`  iOS:     ${evidence.ios === undefined ? 'ABSENT' : evidence.ios.projectName}`);
  console.log(
    `  Android: ${evidence.android === undefined ? 'ABSENT' : `targetSdk ${String(evidence.android.gradle.targetSdkVersion)}`}`,
  );
  console.log(`  Bundle:  ${outputPath}`);
  return 0;
}

function runEvaluate(flags: ParsedArgs['flags']): number {
  const evidencePath = resolvePath(requireString(flags, 'evidence'));
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as MobileReleaseEvidence;
  const attestationsPath = flags.attestations;
  const report = evaluateMobileReleaseGate({
    evidence,
    evaluator: requireString(flags, 'evaluator'),
    ...(typeof attestationsPath === 'string'
      ? { attestations: loadHumanAttestationBundle(resolvePath(attestationsPath)) }
      : {}),
  });
  const outputPath = resolvePath(
    typeof flags.output === 'string' ? flags.output : 'artifacts/mobile-release/decision.json',
  );
  writeJson(outputPath, report);

  if (flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `Mobile release gate (${report.variant} @ ${report.commitSha.slice(0, 8)}): ${report.decision}`,
    );
    console.log(`Required passed: ${report.requiredPassed}; failed: ${report.requiredFailed}`);
    console.log(`Artifact: ${outputPath}`);
    for (const gate of report.gates) {
      if (gate.required && gate.status === 'fail') {
        console.error(`FAIL [${gate.id}]: ${gate.message}`);
      }
    }
  }
  return report.decision === 'GO' ? 0 : 1;
}

function main(): number {
  const { command, flags } = parseArgs(process.argv);
  if (command === '' || flags.help === true || command === '-h' || command === '--help') {
    printHelp();
    return command === '' ? 2 : 0;
  }
  if (command === 'collect') return runCollect(flags);
  if (command === 'evaluate') return runEvaluate(flags);
  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exit(main());
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
