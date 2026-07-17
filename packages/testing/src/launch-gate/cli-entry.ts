
/**
 * CLI entry for beta launch gate evaluation.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHumanAttestationBundle, writeBetaLaunchDecisionArtifact } from './artifact.js';
import { evaluateBetaLaunchGate, exitCodeForDecision } from './evaluate.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function printHelp(): void {
  console.log(`Usage: evaluate-beta-gate [options]

Options:
  --evaluator <name>       Required. Operator or CI identity recording the decision.
  --attestations <path>    JSON bundle of human attestations (fail-closed if omitted for human gates).
  --output <path>          Write decision artifact JSON (default: docs/launch/latest-beta-decision.json).
  --json                   Print full report to stdout.
  -h, --help               Show help.
`);
}

function parseArgs(argv: readonly string[]): {
  evaluator: string;
  attestationsPath?: string;
  outputPath: string;
  json: boolean;
} {
  let evaluator = process.env.BETA_LAUNCH_EVALUATOR ?? '';
  let attestationsPath: string | undefined;
  let outputPath = join(repoRoot, 'docs/launch/latest-beta-decision.json');
  let json = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evaluator') {
      evaluator = argv[++index] ?? '';
    } else if (arg === '--attestations') {
      attestationsPath = argv[++index];
    } else if (arg === '--output') {
      outputPath = argv[++index] ?? outputPath;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!evaluator.trim()) {
    throw new Error('--evaluator is required (or set BETA_LAUNCH_EVALUATOR).');
  }

  return {
    evaluator,
    outputPath,
    json,
    ...(attestationsPath !== undefined ? { attestationsPath } : {}),
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv);
  const report = evaluateBetaLaunchGate({
    repoRoot,
    evaluator: options.evaluator,
    ...(options.attestationsPath !== undefined
      ? { attestations: loadHumanAttestationBundle(options.attestationsPath) }
      : {}),
  });

  writeBetaLaunchDecisionArtifact(options.outputPath, report);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Beta launch gate: ${report.decision}`);
    console.log(`Required passed: ${report.requiredPassed}; failed: ${report.requiredFailed}`);
    console.log(`Artifact: ${options.outputPath}`);
    const failures = report.gates.filter((gate) => gate.required && gate.status === 'fail');
    for (const gate of failures) {
      console.error(`FAIL [${gate.id}]: ${gate.message}`);
    }
  }

  return exitCodeForDecision(report.decision);
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(2);
  });
