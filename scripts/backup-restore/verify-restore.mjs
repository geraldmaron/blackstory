#!/usr/bin/env node
/**
 * Dry-run restore verification CLI (BB-020). Reads export metadata JSON and optional baselines.
 * Default: --dry-run (no gcloud, no network). Exits 0 when all checks pass.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  verifyExportMetadata,
  verifyActiveReleasePointer,
} from './lib/verification.mjs';

function parseArgs(argv) {
  const options = {
    dryRun: true,
    metadata: null,
    baselineCounts: null,
    baselineHashes: null,
    activePointer: null,
    release: null,
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--metadata') {
      options.metadata = argv[++i];
    } else if (arg === '--baseline-counts') {
      options.baselineCounts = argv[++i];
    } else if (arg === '--baseline-hashes') {
      options.baselineHashes = argv[++i];
    } else if (arg === '--active-pointer') {
      options.activePointer = argv[++i];
    } else if (arg === '--release') {
      options.release = argv[++i];
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
  console.log(`Usage: verify-restore.mjs [options]

Options:
  --metadata <file>         Export metadata sidecar JSON (required)
  --baseline-counts <file>  Expected document counts by collection
  --baseline-hashes <file>  Expected collection content hashes
  --active-pointer <file>   publicMeta/activeRelease JSON
  --release <file>          publicationReleases/{id} JSON
  --dry-run                 Default; no cloud calls
  --apply                   Reserved for future live import hook (still no-op today)
  --json                    Machine-readable output
  -h, --help                Show help
`);
}

async function readJson(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  return JSON.parse(await readFile(resolved, 'utf8'));
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.metadata) {
    printHelp();
    process.exit(2);
  }

  if (!options.dryRun) {
    console.error('Note: --apply is reserved; BB-020 performs verification only (no live import).');
  }

  const metadata = await readJson(options.metadata);
  const baselineCounts = options.baselineCounts
    ? await readJson(options.baselineCounts)
    : undefined;
  const baselineHashes = options.baselineHashes
    ? await readJson(options.baselineHashes)
    : undefined;

  const report = {
    dryRun: options.dryRun,
    metadataPath: options.metadata,
    export: verifyExportMetadata(metadata, { baselineCounts, baselineHashes }),
    activeRelease: null,
  };

  if (options.activePointer && options.release) {
    const activePointer = await readJson(options.activePointer);
    const release = await readJson(options.release);
    report.activeRelease = verifyActiveReleasePointer(activePointer, release);
  }

  const ok =
    report.export.ok && (report.activeRelease === null || report.activeRelease.ok);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`BB-020 restore verification (${options.dryRun ? 'dry-run' : 'apply-mode'})`);
    console.log(`Metadata: ${options.metadata}`);
    console.log(`Export checks: ${report.export.ok ? 'PASS' : 'FAIL'}`);
    if (!report.export.ok) {
      for (const error of report.export.errors) {
        console.log(`  - ${error}`);
      }
    }
    if (report.activeRelease) {
      console.log(`Active release pointer: ${report.activeRelease.ok ? 'PASS' : 'FAIL'}`);
      if (!report.activeRelease.ok) {
        for (const error of report.activeRelease.errors) {
          console.log(`  - ${error}`);
        }
      }
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
