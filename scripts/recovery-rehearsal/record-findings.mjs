#!/usr/bin/env node
/**
 * Generates a findings draft from the latest rehearsal timing report (BB-061).
 * Dry-run by default — writes markdown to stdout or --output file.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PATHS, readJson, validateTimingReport } from './lib/rehearsal.mjs';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const options = {
    dryRun: true,
    validate: false,
    report: path.join(SCRIPT_ROOT, 'fixtures/last-rehearsal-report.json'),
    template: DEFAULT_PATHS.breakGlass.replace('break-glass-matrix.json', 'findings-template.md'),
    output: null,
    json: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--validate') {
      options.validate = true;
    } else if (arg === '--report') {
      options.report = argv[++i];
    } else if (arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: record-findings.mjs [--dry-run] [--validate] [--report <file>] [--output <file>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function renderFindings(report, template) {
  const rows = report.procedures
    .filter((p) => p.stepId !== 'declare-and-isolate' && p.stepId !== 'record-findings')
    .map((p) => {
      const pass = p.withinRto ? 'yes' : 'no';
      return `| ${p.label ?? p.stepId} | ${p.rtoTargetMinutes ?? ''} | ${p.measuredMinutes} | ${pass} | |`;
    })
    .join('\n');

  const header = template.split('## Measured recovery times')[0];
  const footer = template.split('## Non-compromised path verification')[1] ?? '';

  return `${header}## Measured recovery times

| Procedure | RTO target (min) | Measured (min) | Pass | Notes |
|-----------|------------------|----------------|------|-------|
${rows}

## Non-compromised path verification${footer}`;
}

async function main() {
  const options = parseArgs(process.argv);
  const report = await readJson(options.report);
  const validation = validateTimingReport(report);

  if (options.validate && !validation.ok) {
    console.error(validation.errors.join('; '));
    process.exit(1);
  }

  const template = await readFile(
    path.join(path.dirname(DEFAULT_PATHS.breakGlass), 'findings-template.md'),
    'utf8',
  );
  const markdown = renderFindings(report, template);

  if (options.json) {
    console.log(JSON.stringify({ ok: validation.ok, report: report.scenarioId, procedures: report.procedures.length }));
    process.exit(0);
  }

  if (options.output) {
    await writeFile(options.output, markdown, 'utf8');
    console.log(`Findings draft written: ${options.output}`);
  } else {
    console.log(markdown);
  }

  process.exit(validation.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
