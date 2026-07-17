#!/usr/bin/env node
/**
 * Recovery and rollback rehearsal runner (BB-061). Dry-run only — simulates all procedures,
 * records measured times from fixtures, validates break-glass paths. No live GCP restore.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PATHS,
  buildTimingReport,
  getProcedureSteps,
  readJson,
  verifyStep,
} from './lib/rehearsal.mjs';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const options = {
    dryRun: true,
    verifyOnly: false,
    step: null,
    json: false,
    output: path.join(SCRIPT_ROOT, 'fixtures/last-rehearsal-report.json'),
    scenario: DEFAULT_PATHS.scenario,
    checklist: DEFAULT_PATHS.checklist,
    timingMatrix: DEFAULT_PATHS.timingMatrix,
    breakGlass: DEFAULT_PATHS.breakGlass,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--verify-only') {
      options.verifyOnly = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--step') {
      options.step = argv[++i];
    } else if (arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--scenario') {
      options.scenario = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: run-rehearsal.mjs [options]

Options:
  --dry-run           Default; fixture-based simulation only
  --verify-only       Run verification checks without writing report
  --step <id>         Run a single checklist step
  --output <file>     Write timing report JSON (default: fixtures/last-rehearsal-report.json)
  --json              Machine-readable stdout
  -h, --help          Show help
`);
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.dryRun) {
    console.error('BB-061: --apply is rejected; rehearsal is dry-run only.');
    process.exit(2);
  }

  const [scenario, checklist, timingMatrix, breakGlassMatrix] = await Promise.all([
    readJson(options.scenario),
    readJson(options.checklist),
    readJson(options.timingMatrix),
    readJson(options.breakGlass),
  ]);

  const steps = getProcedureSteps(checklist, options.step);
  const verifications = [];

  for (const step of steps) {
    const result = await verifyStep(step, scenario, breakGlassMatrix);
    verifications.push(result);
    if (!result.ok) {
      const payload = { ok: false, step: result.stepId, errors: result.errors };
      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.error(`FAIL ${result.stepId}: ${result.errors.join('; ')}`);
      }
      process.exit(1);
    }
    if (!options.verifyOnly && !options.json) {
      console.log(`OK ${result.stepId}: ${result.dryRunNote}`);
    }
  }

  if (options.verifyOnly) {
    const payload = { ok: true, verified: verifications.map((v) => v.stepId) };
    console.log(options.json ? JSON.stringify(payload, null, 2) : `Verified: ${payload.verified.join(', ')}`);
    process.exit(0);
  }

  const report = buildTimingReport(steps, scenario, timingMatrix, Date.now());
  report.verifications = verifications.map((v) => ({
    stepId: v.stepId,
    breakGlassIdentity: v.breakGlassIdentity,
    ok: v.ok,
  }));

  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nRehearsal report written: ${options.output}`);
    console.log(`Total measured: ${report.totalMeasuredMinutes} min | within RTO: ${report.allWithinRto}`);
    for (const proc of report.procedures) {
      const flag = proc.withinRto ? 'PASS' : 'MISS';
      console.log(
        `  ${flag} ${proc.stepId}: ${proc.measuredMinutes} min (target ${proc.rtoTargetMinutes} min)`,
      );
    }
  }

  process.exit(report.allWithinRto ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
