/**
 * WS3 stage-2 prep: turn the flat candidate-pair artifact into EGO-GROUPED batches for
 * cheap-LLM typed-edge proposal. Each ego record = one entity + its candidate neighbors (with
 * context + the signal that surfaced each). Grouping by ego lets the proposer reason about an
 * entity holistically and repeats each entity's context once instead of per-pair.
 *
 * Pure node builtins (no deps). Run from anywhere with node+tsx:
 *   node --conditions development --import tsx split-candidate-batches.ts \
 *     --in <candidates.json> --out-dir <dir> --batches 12
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Side = { id: string; kind: string; displayName: string; summary: string; eraBuckets: string[] };
type Signal = { kind: 'vector'; distance: number } | { kind: 'mention' };
type Pair = { pairKey: string; a: Side; b: Side; signals: Signal[] };
type EgoNeighbor = { id: string; kind: string; displayName: string; summary: string; eraBuckets: string[]; signals: Signal[] };
type Ego = { id: string; kind: string; displayName: string; summary: string; eraBuckets: string[]; neighbors: EgoNeighbor[] };

function parseArgs(argv: readonly string[]): { inPath: string; outDir: string; batches: number } {
  let inPath = '.cache/relationship-candidates.json';
  let outDir = '.cache/candidate-batches';
  let batches = 12;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--in') inPath = resolve(argv[++i] ?? '');
    else if (a === '--out-dir') outDir = resolve(argv[++i] ?? '');
    else if (a === '--batches') batches = Number(argv[++i]);
  }
  if (!Number.isInteger(batches) || batches < 1) throw new Error('--batches must be a positive integer');
  return { inPath, outDir, batches };
}

function main(): void {
  const { inPath, outDir, batches } = parseArgs(process.argv.slice(2));
  const artifact = JSON.parse(readFileSync(inPath, 'utf8')) as { pairs: Pair[] };

  const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
  const egos = new Map<string, Ego>();
  const ensure = (s: Side): Ego => {
    let ego = egos.get(s.id);
    if (!ego) {
      ego = { id: s.id, kind: s.kind, displayName: s.displayName, summary: clip(s.summary, 300), eraBuckets: s.eraBuckets, neighbors: [] };
      egos.set(s.id, ego);
    }
    return ego;
  };
  // Assign each undirected pair to BOTH egos so the proposer always sees a neighbor from its own side.
  for (const p of artifact.pairs) {
    const nb = (to: Side): EgoNeighbor => ({
      id: to.id, kind: to.kind, displayName: to.displayName, summary: clip(to.summary, 140), eraBuckets: to.eraBuckets, signals: p.signals,
    });
    ensure(p.a).neighbors.push(nb(p.b));
    ensure(p.b).neighbors.push(nb(p.a));
  }

  // Sort each ego's neighbors strongest-first (mention, then vector distance desc) for readable prompts.
  const strength = (s: Signal[]): number => {
    if (s.some((x) => x.kind === 'mention')) return 2;
    const d = Math.max(...s.filter((x): x is Extract<Signal, { kind: 'vector' }> => x.kind === 'vector').map((x) => x.distance), 0);
    return d;
  };
  const egoList = [...egos.values()].sort((x, y) => x.id.localeCompare(y.id));
  for (const ego of egoList) ego.neighbors.sort((m, n) => strength(n.signals) - strength(m.signals));

  mkdirSync(outDir, { recursive: true });
  const perBatch = Math.ceil(egoList.length / batches);
  let written = 0;
  for (let b = 0; b < batches; b += 1) {
    const slice = egoList.slice(b * perBatch, (b + 1) * perBatch);
    if (slice.length === 0) continue;
    const name = `batch-${String(b).padStart(2, '0')}.json`;
    writeFileSync(join(outDir, name), JSON.stringify({ batch: b, egos: slice }, null, 2));
    written += 1;
    console.log(`  ${name}: ${slice.length} egos, ${slice.reduce((n, e) => n + e.neighbors.length, 0)} neighbor entries`);
  }
  console.log(`\nWrote ${written} batches to ${outDir} (egos: ${egoList.length})`);
}

main();
