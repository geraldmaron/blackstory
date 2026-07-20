/**
 * Build enrichment-run subjects for the starter-seed entities (and the starter
 * records that matched already-published entities) with REAL source material:
 * fetches each claim's citation URL and embeds readable page text into
 * `sourceSnippets`, so the editorial judge can extract additional evidenced
 * claims (founding years, program details, people) instead of only seeing the
 * one-line summary it was seeded with.
 *
 * Subjects carry the location/kind metadata `auto-promote-corsair-keeps.ts`
 * needs downstream, so the whole loop is: this script → enrichment-run (Corsair,
 * hybrid free-model roster) → auto-promote → publish-national-catalog.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-starter-enrichment-subjects.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
const reportPath = join(repoRoot, '.cache/starter-seed/report.json');
const outDir = join(repoRoot, '.cache/starter-enrichment');

const MAX_SNIPPET_CHARS = 4_000;
const FETCH_TIMEOUT_MS = 20_000;

type CatalogEntry = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly historicalContext?: string;
  readonly jurisdictionLabel: string;
  readonly locationPrecision: string;
  readonly locationLabel: string;
  readonly lat: number;
  readonly lng: number;
  readonly claims?: readonly { readonly citationHref?: string }[];
};

function loadCatalogEntries(): Map<string, CatalogEntry> {
  const entries = new Map<string, CatalogEntry>();
  for (const file of readdirSync(catalogDir)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as CatalogEntry[];
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (entry?.id) entries.set(entry.id, entry);
    }
  }
  return entries;
}

/** Crude but dependency-free readability: drop script/style/nav, strip tags, collapse space. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/giu, ' ')
    .replace(/<header[\s\S]*?<\/header>/giu, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&#\d+;|&[a-z]+;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function fetchSourceText(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)' },
    });
    if (!response.ok) return undefined;
    const text = htmlToText(await response.text());
    return text.length > 100 ? text.slice(0, MAX_SNIPPET_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const catalog = loadCatalogEntries();
  const starterEntries = JSON.parse(
    readFileSync(join(catalogDir, 'starter-seed-2026-07.json'), 'utf8'),
  ) as CatalogEntry[];
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
    duplicatesAsEnrichmentTargets: readonly { existingEntityId: string }[];
  };
  const enrichmentTargetIds = report.duplicatesAsEnrichmentTargets.map((d) => d.existingEntityId);
  const targets: CatalogEntry[] = [
    ...starterEntries,
    ...enrichmentTargetIds
      .map((id) => catalog.get(id))
      .filter((entry): entry is CatalogEntry => entry !== undefined),
  ];

  mkdirSync(outDir, { recursive: true });
  const subjects: Array<Record<string, unknown>> = [];
  let fetched = 0;
  let unreachable = 0;

  for (const entry of targets) {
    const urls = [
      ...new Set(
        (entry.claims ?? [])
          .map((claim) => claim.citationHref)
          .filter((href): href is string => typeof href === 'string' && href.length > 0),
      ),
    ];
    const snippets: string[] = [];
    for (const url of urls) {
      const text = await fetchSourceText(url);
      if (text) {
        fetched += 1;
        snippets.push(`SOURCE ${url}\n${text}`);
      } else {
        unreachable += 1;
        snippets.push(`SOURCE ${url}\n(page not fetchable at build time; cite only if the summary supports the claim)`);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    subjects.push({
      subjectId: entry.id,
      title: entry.displayName,
      kind: entry.kind,
      existingSummary: entry.summary,
      ...(entry.historicalContext ? { existingContext: entry.historicalContext } : {}),
      sourceSnippets: snippets,
      jurisdictionLabel: entry.jurisdictionLabel,
      locationPrecision: entry.locationPrecision,
      locationLabel: entry.locationLabel,
      lat: entry.lat,
      lng: entry.lng,
    });
    console.error(`built subject ${entry.id} (${snippets.length} sources)`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const outPath = join(outDir, `subjects-${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify({ subjects, count: subjects.length, source: 'starter-seed-2026-07 + enrichment targets' }, null, 2)}\n`);
  console.log(JSON.stringify({ subjects: subjects.length, sourcesFetched: fetched, sourcesUnreachable: unreachable, outPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
