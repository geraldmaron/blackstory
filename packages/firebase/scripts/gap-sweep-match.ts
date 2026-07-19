/**
 * Gap-sweep match: aggregate extracted name mentions, then deterministically + kind-awarely
 * match against the catalog to classify each referenced name as:
 *   - present:        a catalog record with a matching name AND a compatible kind exists
 *   - kind_mismatch:  a name match exists but only under a different kind (e.g. "SCLC" the org
 *                     referenced, but the catalog only has the SCLC *founding event*)
 *   - absent:         no catalog record matches the name at all
 * Ranks absent + kind_mismatch by how many distinct source entities reference them.
 *
 * node --conditions development --import tsx gap-sweep-match.ts --extract-dir <dir> --out <json> [--min-sources 2]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

// kinds that count as "the same sort of thing" for match purposes
const KIND_GROUP: Record<string, string> = {
  person: 'person', organization: 'org', institution: 'org', school: 'org',
  event: 'event', place: 'place', law: 'law', case: 'case', publication: 'work',
  artifact: 'work', movement: 'movement', other: 'other',
};

type Entity = { id: string; kind: string; displayName?: string; aliases?: string[] };
type Mention = { canonicalName?: string; inferredKind?: string; mentionedBy?: string };

function parseArgs(argv: readonly string[]) {
  let extractDir = resolve('.cache/gap-batches');
  let outPath = resolve('.cache/gap-report.json');
  let minSources = 2;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--extract-dir') extractDir = resolve(argv[++i] ?? '');
    else if (argv[i] === '--out') outPath = resolve(argv[++i] ?? '');
    else if (argv[i] === '--min-sources') minSources = Number(argv[++i]);
  }
  return { extractDir, outPath, minSources };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function main(): void {
  const { extractDir, outPath, minSources } = parseArgs(process.argv.slice(2));

  // Catalog name index: normalized name -> set of kind-groups.
  const catalogNames = new Map<string, Set<string>>();
  for (const f of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const arr = JSON.parse(readFileSync(join(catalogDir, f), 'utf8')) as unknown;
    if (!Array.isArray(arr)) continue;
    for (const e of arr as Entity[]) {
      const kg = KIND_GROUP[e.kind] ?? 'other';
      for (const nm of [e.displayName ?? e.id, ...(Array.isArray(e.aliases) ? e.aliases : [])]) {
        const n = norm(nm);
        if (!n) continue;
        if (!catalogNames.has(n)) catalogNames.set(n, new Set());
        catalogNames.get(n)!.add(kg);
      }
    }
  }
  const catalogKeys = [...catalogNames.keys()];

  // Aggregate mentions by normalized name.
  type Agg = { display: string; kinds: Map<string, number>; sources: Set<string> };
  const agg = new Map<string, Agg>();
  for (const f of readdirSync(extractDir).filter((n) => /^extracted-\d+\.json$/.test(n))) {
    const parsed = JSON.parse(readFileSync(join(extractDir, f), 'utf8')) as { mentions?: Mention[] };
    for (const m of parsed.mentions ?? []) {
      const name = (m.canonicalName ?? '').trim();
      const n = norm(name);
      if (!n || n.length < 3) continue;
      let a = agg.get(n);
      if (!a) { a = { display: name, kinds: new Map(), sources: new Set() }; agg.set(n, a); }
      const kg = KIND_GROUP[m.inferredKind ?? 'other'] ?? 'other';
      a.kinds.set(kg, (a.kinds.get(kg) ?? 0) + 1);
      if (m.mentionedBy) a.sources.add(m.mentionedBy);
    }
  }

  function findNameMatch(n: string): Set<string> | undefined {
    if (catalogNames.has(n)) return catalogNames.get(n);
    // strong containment either direction (whole-phrase), for suffix/prefix variants
    for (const k of catalogKeys) {
      if (k.length >= 6 && (k.includes(n) || n.includes(k)) && Math.abs(k.length - n.length) <= Math.max(k.length, n.length) * 0.5) {
        return catalogNames.get(k);
      }
    }
    return undefined;
  }

  const absent: any[] = [];
  const kindMismatch: any[] = [];
  for (const [n, a] of agg) {
    const sources = a.sources.size;
    if (sources < minSources) continue;
    const topKind = [...a.kinds.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'other';
    const match = findNameMatch(n);
    const row = { name: a.display, inferredKindGroup: topKind, sources, existsAsKinds: match ? [...match] : [] };
    if (!match) absent.push(row);
    else if (!match.has(topKind)) kindMismatch.push(row);
  }
  absent.sort((x, y) => y.sources - x.sources);
  kindMismatch.sort((x, y) => y.sources - x.sources);

  writeFileSync(outPath, JSON.stringify({
    totals: { distinctNames: agg.size, absent: absent.length, kindMismatch: kindMismatch.length, minSources },
    kindMismatch, absent,
  }, null, 2));

  console.log('=== Gap sweep report ===');
  console.log(`distinct referenced names: ${agg.size} | absent (>= ${minSources} sources): ${absent.length} | kind-mismatch: ${kindMismatch.length}`);
  console.log('\n--- KIND MISMATCH (exists, but not as the referenced kind) top 20 ---');
  for (const r of kindMismatch.slice(0, 20)) console.log(`  ${r.sources}x  ${r.name}  [want ${r.inferredKindGroup}; have ${r.existsAsKinds.join(',')}]`);
  console.log('\n--- ABSENT (no catalog record) top 30 ---');
  for (const r of absent.slice(0, 30)) console.log(`  ${r.sources}x  [${r.inferredKindGroup}]  ${r.name}`);
  console.log(`\nwrote ${outPath}`);
}

main();
