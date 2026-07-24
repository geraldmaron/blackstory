/**
 * Gap-sweep prep: build per-entity text records (summary + historicalContext + claim objects)
 * and chunk them into batches for LLM named-entity extraction. The extraction finds people/
 * orgs/events/places/laws/movements NAMED in each entity's prose; a later deterministic step
 * matches those names against the catalog to surface the ones that do NOT yet exist.
 *
 * node --conditions development --import tsx gap-sweep-prep.ts --out-dir <dir> --batches 24
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type Claim = { predicate?: string; object?: string };
type Entity = { id: string; kind: string; displayName?: string; summary?: string; historicalContext?: string; claims?: Claim[] };

function parseArgs(argv: readonly string[]): { outDir: string; batches: number } {
  let outDir = resolve('.cache/gap-batches');
  let batches = 24;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir') outDir = resolve(argv[++i] ?? '');
    else if (argv[i] === '--batches') batches = Number(argv[++i]);
  }
  return { outDir, batches };
}

function textFor(e: Entity): string {
  const claims = (e.claims ?? []).map((c) => c.object ?? '').filter(Boolean).slice(0, 6).join(' ');
  const raw = [e.summary ?? '', e.historicalContext ?? '', claims].filter(Boolean).join(' — ');
  return raw.length > 1400 ? `${raw.slice(0, 1399)}…` : raw;
}

function main(): void {
  const { outDir, batches } = parseArgs(process.argv.slice(2));
  const records: { id: string; name: string; kind: string; text: string }[] = [];
  for (const f of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const arr = JSON.parse(readFileSync(join(catalogDir, f), 'utf8')) as unknown;
    if (Array.isArray(arr)) for (const e of arr as Entity[]) {
      if (e?.id) records.push({ id: e.id, name: e.displayName ?? e.id, kind: e.kind, text: textFor(e) });
    }
  }
  records.sort((a, b) => a.id.localeCompare(b.id));

  mkdirSync(outDir, { recursive: true });
  const perBatch = Math.ceil(records.length / batches);
  let written = 0;
  for (let b = 0; b < batches; b += 1) {
    const slice = records.slice(b * perBatch, (b + 1) * perBatch);
    if (slice.length === 0) continue;
    writeFileSync(join(outDir, `gap-${String(b).padStart(2, '0')}.json`), JSON.stringify({ batch: b, entities: slice }, null, 2));
    written += 1;
  }
  console.log(`Wrote ${written} gap-sweep batches (${records.length} entities) to ${outDir}`);
}

main();
