#!/usr/bin/env node
/**
 * Capture-completeness remediation operator script (fixture-first, dry-run by default).
 *
 * Loads a citation batch, runs `evaluateCaptureCompleteness` from `@repo/domain`, and prints
 * ratio / meetsBar / missing ids. Optional `--submit-spn` plans Wayback backfill for missing
 * web citations without calling live Save Page Now unless `CAPTURE_REMEDIATION_SPN=1` (stub).
 *
 * Run:
 *   node --conditions development --import tsx scripts/capture-remediation.mjs
 *   node --conditions development --import tsx scripts/capture-remediation.mjs --input path.json --submit-spn
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = path.join(
  ROOT,
  'scripts/fixtures/capture-remediation-sample-citations.json',
);
const DOMAIN_CAPTURE_MODULE = path.join(
  ROOT,
  'packages/domain/src/capture-completeness/index.ts',
);

const DEFAULT_SUBMIT_LIMIT = 20;

function printUsage() {
  console.log(`Usage: node --conditions development --import tsx scripts/capture-remediation.mjs [options]

Options:
  --input <path>       Citation JSON fixture (default: scripts/fixtures/capture-remediation-sample-citations.json)
  --dry-run            Measure only; do not plan or submit SPN jobs (default)
  --submit-spn         Plan Wayback SPN backfill for missing web citations (still dry unless CAPTURE_REMEDIATION_SPN=1)
  --limit <n>          Max citations to include in an SPN plan (default: ${DEFAULT_SUBMIT_LIMIT})
  -h, --help           Show this help

Environment:
  CAPTURE_REMEDIATION_SPN=1   Opt-in stub for live SPN (not enabled by default; no network calls in stub)
`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ input: string, dryRun: boolean, submitSpn: boolean, limit: number, help: boolean }} */
  const options = {
    input: DEFAULT_INPUT,
    dryRun: true,
    submitSpn: false,
    limit: DEFAULT_SUBMIT_LIMIT,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      options.submitSpn = false;
    } else if (arg === '--submit-spn') {
      options.submitSpn = true;
      options.dryRun = false;
    } else if (arg === '--input') {
      const next = argv[i + 1];
      if (!next) throw new Error('--input requires a path');
      options.input = path.resolve(next);
      i += 1;
    } else if (arg === '--limit') {
      const next = argv[i + 1];
      if (!next) throw new Error('--limit requires a number');
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = parsed;
      i += 1;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

/**
 * @param {unknown} parsed
 * @returns {unknown[]}
 */
function extractCitations(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(/** @type {{ citations?: unknown[] }} */ (parsed).citations)
  ) {
    return /** @type {{ citations: unknown[] }} */ (parsed).citations;
  }
  throw new Error('Input must be a JSON array or an object with a citations[] field');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} citation
 * @param {number} index
 */
function validateCitationShape(citation, index) {
  const context = `citations[${index}]`;
  if (!citation || typeof citation !== 'object') {
    throw new Error(`${context}: must be an object`);
  }
  const row = /** @type {Record<string, unknown>} */ (citation);
  if (!isNonEmptyString(row.citationId)) {
    throw new Error(`${context}: citationId is required`);
  }
  if (!row.location || typeof row.location !== 'object') {
    throw new Error(`${context}: location is required`);
  }
  if (!row.capture || typeof row.capture !== 'object') {
    throw new Error(`${context}: capture is required`);
  }
  return row;
}

/**
 * @param {string} inputPath
 */
async function loadCitations(inputPath) {
  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = extractCitations(parsed);
  return rows.map(validateCitationShape);
}

async function loadDomainEvaluator() {
  return import(pathToFileUrl(DOMAIN_CAPTURE_MODULE));
}

/**
 * @param {string} absolutePath
 */
function pathToFileUrl(absolutePath) {
  return new URL(`file://${absolutePath.replace(/\\/g, '/')}`).href;
}

/**
 * @param {Record<string, unknown>[]} citations
 * @param {string[]} missingIds
 */
function citationsById(citations, missingIds) {
  const missingSet = new Set(missingIds);
  return citations.filter((citation) => missingSet.has(String(citation.citationId)));
}

/**
 * @param {Record<string, unknown>} citation
 * @returns {string | undefined}
 */
function webCitationUrl(citation) {
  const location = citation.location;
  if (!location || typeof location !== 'object') return undefined;
  const kind = /** @type {{ kind?: unknown, url?: unknown }} */ (location).kind;
  const url = /** @type {{ kind?: unknown, url?: unknown }} */ (location).url;
  if (kind === 'url' && isNonEmptyString(url)) return url.trim();
  return undefined;
}

/**
 * @param {number} limit
 * @param {number} dailyCap
 */
function effectiveSubmitCap(limit, dailyCap) {
  return Math.min(limit, dailyCap);
}

/**
 * @param {Record<string, unknown>[]} missingCitations
 * @param {{ limit: number, dailyCap: number, dryRun: boolean }} options
 */
async function planSpnSubmissions(missingCitations, options) {
  const cap = effectiveSubmitCap(options.limit, options.dailyCap);
  const queue = missingCitations.slice(0, cap);
  const skipped = Math.max(0, missingCitations.length - queue.length);

  console.log('');
  console.log('SPN remediation plan');
  console.log(`  dailyCap: ${options.dailyCap}`);
  console.log(`  limit: ${options.limit}`);
  console.log(`  effectiveCap: ${cap}`);
  console.log(`  missingTotal: ${missingCitations.length}`);
  console.log(`  wouldSubmit: ${queue.length}`);
  if (skipped > 0) {
    console.log(`  deferredByCap: ${skipped}`);
  }
  console.log('');

  if (queue.length === 0) {
    console.log('Nothing to submit.');
    return { submitted: 0, stubbed: false };
  }

  for (const citation of queue) {
    const url = webCitationUrl(citation);
    if (!url) {
      console.log(`- ${citation.citationId}: skipped (not a url citation)`);
      continue;
    }
    console.log(`- ${citation.citationId}: would submit ${url}`);
  }

  const liveSpn = process.env.CAPTURE_REMEDIATION_SPN === '1';
  if (!liveSpn) {
    console.log('');
    console.log('Dry-run only: no live Wayback SPN calls (set CAPTURE_REMEDIATION_SPN=1 to enable stub).');
    return { submitted: 0, stubbed: false };
  }

  console.log('');
  console.log('CAPTURE_REMEDIATION_SPN=1: live SPN path is intentionally stubbed in this script.');
  console.log('Route captures through captureUrlToEvidencePointer + operator review — see runbook.');
  return { submitted: 0, stubbed: true };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const domain = await loadDomainEvaluator();
  const citations = await loadCitations(options.input);
  const result = domain.evaluateCaptureCompleteness(citations);

  console.log('Capture completeness remediation');
  console.log(`Input: ${options.input}`);
  console.log(`Ops bar version: ${domain.captureCompletenessOpsBarVersion()}`);
  console.log(`Bar ratio: ${domain.CAPTURE_COMPLETENESS_BAR_RATIO}`);
  console.log(`Mode: ${options.submitSpn ? 'submit-spn (plan)' : 'dry-run (measure only)'}`);
  console.log('');
  console.log(`ratio: ${result.ratio}`);
  console.log(`meetsBar: ${result.meetsBar}`);
  console.log(`missing (${result.missing.length}):`);
  if (result.missing.length === 0) {
    console.log('  (none)');
  } else {
    for (const citationId of result.missing) {
      console.log(`  - ${citationId}`);
    }
  }

  if (options.submitSpn && result.missing.length > 0) {
    const missingCitations = citationsById(citations, [...result.missing]);
    await planSpnSubmissions(missingCitations, {
      limit: options.limit,
      dailyCap: domain.CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP,
      dryRun: options.dryRun,
    });
  } else if (options.submitSpn) {
    console.log('');
    console.log('SPN remediation plan: nothing missing — no submissions planned.');
  } else {
    console.log('');
    console.log('Dry-run complete. Re-run with --submit-spn to plan bounded Wayback backfill.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
