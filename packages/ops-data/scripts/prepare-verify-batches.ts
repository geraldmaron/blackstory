/**
 * WS4 stage-2 prep: enrich staged edges with both endpoints' context (displayName, kind,
 * trimmed summary) and chunk them into batches for adversarial verification by a stronger model.
 *
 * node --conditions development --import tsx prepare-verify-batches.ts \
 *   --staged <staged-edges.json> --out-dir <dir> --batches 18
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type Edge = { fromEntityId: string; toEntityId: string; type: string; direction?: string; confidence?: string; rationale?: string; evidenceHint?: string };
type Ctx = { kind: string; displayName: string; summary: string };

function parseArgs(argv: readonly string[]): { staged: string; outDir: string; batches: number } {
  let staged = resolve('.cache/staged-edges.json');
  let outDir = resolve('.cache/verify-batches');
  let batches = 18;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--staged') staged = resolve(argv[++i] ?? '');
    else if (a === '--out-dir') outDir = resolve(argv[++i] ?? '');
    else if (a === '--batches') batches = Number(argv[++i]);
  }
  return { staged, outDir, batches };
}

function loadContext(): Map<string, Ctx> {
  const byId = new Map<string, Ctx>();
  const clip = (t: string, n: number) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t ?? '');
  for (const file of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as { id: string; kind: string; displayName?: string; summary?: string }[];
    if (Array.isArray(parsed)) for (const e of parsed) if (e?.id) byId.set(e.id, { kind: e.kind, displayName: e.displayName ?? e.id, summary: clip(e.summary ?? '', 240) });
  }
  return byId;
}

function main(): void {
  const { staged, outDir, batches } = parseArgs(process.argv.slice(2));
  const ctx = loadContext();
  const { edges } = JSON.parse(readFileSync(staged, 'utf8')) as { edges: Edge[] };

  const enriched = edges.map((e, i) => ({
    idx: i,
    ...e,
    from: ctx.get(e.fromEntityId),
    to: ctx.get(e.toEntityId),
  }));

  mkdirSync(outDir, { recursive: true });
  const perBatch = Math.ceil(enriched.length / batches);
  let written = 0;
  for (let b = 0; b < batches; b += 1) {
    const slice = enriched.slice(b * perBatch, (b + 1) * perBatch);
    if (slice.length === 0) continue;
    writeFileSync(join(outDir, `verify-${String(b).padStart(2, '0')}.json`), JSON.stringify({ batch: b, edges: slice }, null, 2));
    written += 1;
  }
  console.log(`Wrote ${written} verify batches (${enriched.length} edges) to ${outDir}`);
}

main();
