/**
 * Thin-source expander (staging only): for catalog entities with ≤2 claims, query
 * SearXNG for additional authority-host leads. Writes a JSON report — never
 * mutates fixtures or publishes. Human review + attach-evidence remain required.
 *
 * Usage:
 *   SEARXNG_BASE_URL=http://100.119.72.84:8888 \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/expand-thin-sources.ts --limit 20 --out /tmp/thin-source-leads.json
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type CatalogClaim = {
  readonly citationSource?: string;
  readonly citationHref?: string;
  readonly citationLabel?: string;
};

type CatalogEntity = {
  readonly id: string;
  readonly displayName?: string;
  readonly kind?: string;
  readonly summary?: string;
  readonly claims?: readonly CatalogClaim[];
};

const AUTHORITY_HINTS = [
  'site:loc.gov',
  'site:nps.gov',
  'site:archives.gov',
  'site:si.edu',
  'site:wikipedia.org',
];

function parseArgs(argv: readonly string[]): { limit: number; out: string; catalogDir: string } {
  let limit = 20;
  let out = '/tmp/thin-source-leads.json';
  let catalogDir = 'packages/firebase/fixtures/national-catalog';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') limit = Number(argv[++i] ?? limit);
    else if (arg === '--out') out = String(argv[++i] ?? out);
    else if (arg === '--catalog-dir') catalogDir = String(argv[++i] ?? catalogDir);
  }
  return { limit, out, catalogDir };
}

function loadThinEntities(catalogDir: string): CatalogEntity[] {
  const ents: CatalogEntity[] = [];
  for (const name of readdirSync(catalogDir)) {
    if (!name.endsWith('.json') || name.startsWith('_')) continue;
    const raw = JSON.parse(readFileSync(join(catalogDir, name), 'utf8')) as unknown;
    const items = Array.isArray(raw) ? raw : (raw as { entities?: unknown }).entities;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const e = item as CatalogEntity;
      if (!e.id) continue;
      if ((e.claims?.length ?? 0) <= 2) ents.push(e);
    }
  }
  return ents;
}

async function searxngSearch(query: string): Promise<readonly { title: string; url: string }[]> {
  const base = process.env.SEARXNG_BASE_URL ?? 'http://127.0.0.1:8888';
  const url = new URL('/search', base);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SearXNG ${res.status} for ${query}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string }[] };
  return (data.results ?? [])
    .filter((r) => r.title && r.url)
    .slice(0, 5)
    .map((r) => ({ title: r.title!, url: r.url! }));
}

async function main(): Promise<void> {
  const { limit, out, catalogDir } = parseArgs(process.argv.slice(2));
  const thin = loadThinEntities(catalogDir).slice(0, limit);
  const report: {
    generatedAt: string;
    searxngBase: string;
    entities: {
      id: string;
      title: string;
      existingSources: string[];
      leads: { title: string; url: string; query: string }[];
    }[];
  } = {
    generatedAt: new Date().toISOString(),
    searxngBase: process.env.SEARXNG_BASE_URL ?? 'http://127.0.0.1:8888',
    entities: [],
  };

  for (const entity of thin) {
    const title = entity.displayName ?? entity.id;
    const existing = (entity.claims ?? [])
      .map((c) => c.citationSource ?? c.citationHref ?? '')
      .filter(Boolean);
    const leads: { title: string; url: string; query: string }[] = [];
    for (const hint of AUTHORITY_HINTS.slice(0, 2)) {
      const query = `"${title}" Black history ${hint}`;
      try {
        const hits = await searxngSearch(query);
        for (const hit of hits) {
          if (existing.some((s) => hit.url.includes(s) || s.includes(hit.url))) continue;
          if (leads.some((l) => l.url === hit.url)) continue;
          leads.push({ ...hit, query });
        }
      } catch (error) {
        console.error(`search failed for ${entity.id}:`, error);
      }
    }
    report.entities.push({
      id: entity.id,
      title,
      existingSources: existing,
      leads: leads.slice(0, 6),
    });
    console.error(`expanded ${entity.id}: ${leads.length} leads`);
  }

  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      out,
      entityCount: report.entities.length,
      leadCount: report.entities.reduce((n, e) => n + e.leads.length, 0),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
