/**
 * County/state-targeted sundown-town discovery entrypoint. Uses the shared
 * research-directive loop in operator-cli (plan→gather→extract→decide) with
 * Tougaloo GeoJSON for plan seeding and DNS-pinned safe-fetch for real pages.
 *
 * Dry-run by default — prints JSON report. `--apply` writes staged candidates
 * under fixtures/sundown-towns-research/runs/.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-sundown-towns.ts \
 *     --state Illinois [--county Pekin] [--limit 10] [--apply]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeFetchText } from './lib/safe-fetch.ts';
import {
  loadTougalooGeojsonFeatures,
  runSundownTownCountyBrief,
  TOUGALOO_GEOJSON_URL,
} from '../../operator-cli/src/research-directive.ts';
import { createNodeSafeFetchDependencies } from '../../operator-cli/src/fetch.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const runsDir = join(repoRoot, 'packages/firebase/fixtures/sundown-towns-research/runs');
const reportPath = join(repoRoot, '.cache/sundown-town-directive/report.json');

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const APPLY = process.argv.includes('--apply');
const STATE = readArgFlag('--state');
const COUNTY = readArgFlag('--county');
const LIMIT = Number(readArgFlag('--limit') ?? '25');

async function main(): Promise<void> {
  if (!STATE?.trim()) {
    throw new Error('Missing required --state (e.g. --state Illinois)');
  }

  const features = await loadTougalooGeojsonFeatures(async () => {
    const page = await safeFetchText(TOUGALOO_GEOJSON_URL);
    if (!page) throw new Error(`Could not fetch Tougaloo GeoJSON at ${TOUGALOO_GEOJSON_URL}`);
    return JSON.parse(page.text) as { features?: unknown[] };
  });

  const result = await runSundownTownCountyBrief(
    {
      state: STATE.trim(),
      ...(COUNTY ? { county: COUNTY.trim() } : {}),
      limit: LIMIT,
    },
    features,
    { dependencies: createNodeSafeFetchDependencies() },
  );

  const payload = {
    generatedAt: result.completedAt,
    brief: result.plan.subject,
    decision: result.decision,
    candidateCount: result.extracted.candidates.length,
    fetchedUrlCount: result.gathered.fetchedUrlCount,
    candidates: result.extracted.candidates,
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);

  if (APPLY) {
    mkdirSync(runsDir, { recursive: true });
    const slug = `${STATE.trim().toLowerCase().replace(/\s+/gu, '-')}${COUNTY ? `-${COUNTY.trim().toLowerCase().replace(/\s+/gu, '-')}` : ''}`;
    const outPath = join(runsDir, `${slug}-${result.completedAt.slice(0, 10)}.json`);
    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.error(`Wrote staged run: ${outPath}`);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
