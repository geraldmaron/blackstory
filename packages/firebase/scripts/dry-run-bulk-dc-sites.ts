/**
 * Dry-run validation and triage for the DC Black History Sites bulk discovery fixture.
 * Reads the git-durable fixture produced by import-bulk-source-programs.ts, validates
 * schema/geo/catalog overlap, and writes a JSON + markdown report. No Firebase writes.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/dry-run-bulk-dc-sites.ts
 *
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/dry-run-bulk-dc-sites.ts \
 *     --fixture=packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadCatalogIndexFromDir,
  triageBulkDcSitesFixture,
  type BulkDcSitesFixture,
  type BulkDcTriageReport,
} from './lib/bulk-dc-sites-triage.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const defaultFixture = join(
  repoRoot,
  'packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json',
);
const defaultCatalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
const reportJsonPath = join(repoRoot, '.cache/bulk-dc-sites/triage-report.json');
const reportMdPath = join(repoRoot, 'docs/research/dc-black-history-sites-triage-report.md');

function readArgFlag(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefixed));
  if (hit) return hit.slice(prefixed.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function renderMarkdown(report: BulkDcTriageReport): string {
  const lines: string[] = [
    '# DC Black History Sites — bulk lane triage report',
    '',
    `Generated: ${report.generatedAt}`,
    ...(report.fixtureGeneratedAt ? [`Fixture generated: ${report.fixtureGeneratedAt}`] : []),
    `Fixture: \`${report.fixturePath}\` (${report.bytes.toLocaleString()} bytes)`,
    '',
    '## Counts',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Candidates | ${report.counts.candidates} |`,
    `| Validation errors | ${report.counts.validationErrors} |`,
    `| With geo | ${report.counts.withGeo} |`,
    `| Missing geo | ${report.counts.missingGeo} |`,
    `| In DC bbox | ${report.counts.inDcBounds} |`,
    `| Out of DC bbox | ${report.counts.outOfDcBounds} |`,
    `| People category (privacy lane) | ${report.counts.peopleCategory} |`,
    `| Catalog existing match | ${report.counts.catalogExistingMatch} |`,
    `| Catalog new candidate | ${report.counts.catalogNewCandidate} |`,
    `| Fallback data.gov URL | ${report.counts.fallbackCatalogUrl} |`,
    '',
    '## Source categories',
    '',
    '| Category | Count |',
    '| --- | ---: |',
    ...Object.entries(report.categories)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => `| ${category} | ${count} |`),
    '',
    '## Triage dispositions',
    '',
    '| Disposition | Count | Meaning |',
    '| --- | ---: | --- |',
    `| enrichment_ready | ${report.dispositions.enrichment_ready} | New place candidate; proceed to source fetch + enrichment |`,
    `| catalog_enrich | ${report.dispositions.catalog_enrich} | Overlaps published catalog — enrich existing entity |`,
    `| privacy_review | ${report.dispositions.privacy_review} | People-typed site; living/residence review before pin |`,
    `| geo_hold | ${report.dispositions.geo_hold} | Missing or out-of-bbox coordinates |`,
    `| validation_error | ${report.dispositions.validation_error} | Fixture schema/contract violation |`,
    '',
    '## Canonical URL hosts (top 8)',
    '',
    '| Host | Count |',
    '| --- | ---: |',
    ...Object.entries(report.urlHosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([host, count]) => `| ${host} | ${count} |`),
    '',
    '## Pipeline (no Firebase writes in this script)',
    '',
    '1. `import-bulk-source-programs.ts --lane=dc-sites` → git fixture',
    '2. `dry-run-bulk-dc-sites.ts` (this script) → triage report',
    '3. `build-discovery-enrichment-subjects.ts --candidates <fixture>` → fetch sources',
    '4. Operator enrichment + `auto-promote-corsair-keeps.ts` → national-catalog fixture',
    '5. Human `publish-national-catalog.ts` (DRY_RUN=1 first) → Firestore release docs',
    '',
    'Regenerate: `node --conditions development --import tsx packages/firebase/scripts/dry-run-bulk-dc-sites.ts`',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const fixturePath = readArgFlag('fixture') ?? defaultFixture;
  const catalogDir = readArgFlag('catalog-dir') ?? defaultCatalogDir;
  const jsonOut = readArgFlag('json') ?? reportJsonPath;
  const mdOut = readArgFlag('md') ?? reportMdPath;

  if (!existsSync(fixturePath)) {
    console.error(`Missing fixture: ${fixturePath}`);
    process.exit(2);
  }

  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as BulkDcSitesFixture;
  if (!Array.isArray(fixture.candidates)) {
    console.error('Fixture missing candidates array');
    process.exit(2);
  }

  const report = triageBulkDcSitesFixture({
    fixture,
    fixturePath,
    bytes: statSync(fixturePath).size,
    catalogIndex: loadCatalogIndexFromDir(catalogDir),
  });

  mkdirSync(dirname(jsonOut), { recursive: true });
  mkdirSync(dirname(mdOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdOut, renderMarkdown(report));

  console.log('=== DC Black History Sites bulk dry-run ===');
  console.log(`Fixture: ${fixturePath} (${report.bytes.toLocaleString()} bytes)`);
  console.log(`Candidates: ${report.counts.candidates}`);
  console.log(`Validation errors: ${report.counts.validationErrors}`);
  console.log(`Geo: ${report.counts.withGeo} with / ${report.counts.missingGeo} missing / ${report.counts.outOfDcBounds} out-of-bbox`);
  console.log(`Catalog: ${report.counts.catalogExistingMatch} existing / ${report.counts.catalogNewCandidate} new`);
  console.log('Dispositions:', report.dispositions);
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${mdOut}`);

  if (report.counts.validationErrors > 0) {
    process.exitCode = 1;
  }
}

main();
