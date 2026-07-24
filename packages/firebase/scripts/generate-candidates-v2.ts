/**
 * WS3 wave-2: higher-recall candidate generation TARGETING currently-isolated entities.
 * Reads the current fixtures (whose related[] now include wave-1 edges), computes the current
 * undirected adjacency to find isolated nodes + existing pairs, then runs higher-K vector KNN
 * (default K=25, min-distance 0.50) and keeps ONLY new pairs that touch >=1 isolated entity and
 * are not already edges. This concentrates fresh candidates where the graph is still dark.
 *
 * Read-only against production Firestore. Same prod env as the backfill.
 *   node --conditions development --import tsx generate-candidates-v2.ts [--k 25] [--min-distance 0.50] [--out <path>]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerFirebaseApp } from '../src/server.js';
import { createAdminVectorIndexStore } from '../src/embeddings/vector-store.js';
import { ENTITY_EMBEDDINGS_COLLECTION, VECTOR_FIELD_NAME } from '../src/embeddings/constants.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type Related = { id: string; type: string; direction: string };
type CatalogEntity = { id: string; kind: string; displayName?: string; summary?: string; eraBuckets?: string[]; related?: Related[] };

function parseArgs(argv: readonly string[]) {
  let k = 25, minDistance = 0.5, outPath = resolve('.cache/relationship-candidates-v2.json');
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--k') k = Number(argv[++i]);
    else if (a === '--min-distance') minDistance = Number(argv[++i]);
    else if (a === '--out') outPath = resolve(argv[++i] ?? '');
  }
  return { k, minDistance, outPath };
}

function loadCatalog(): CatalogEntity[] {
  const out: CatalogEntity[] = [];
  for (const f of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const arr = JSON.parse(readFileSync(join(catalogDir, f), 'utf8')) as unknown;
    if (Array.isArray(arr)) for (const e of arr as CatalogEntity[]) out.push(e);
  }
  return out;
}

function pairKey(a: string, b: string): string { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function clip(t: string | undefined, n: number): string { return t && t.length > n ? `${t.slice(0, n - 1)}…` : t ?? ''; }
function toVector(raw: unknown): number[] | undefined {
  if (Array.isArray(raw)) return raw as number[];
  if (raw && typeof (raw as { toArray?: () => number[] }).toArray === 'function') return (raw as { toArray: () => number[] }).toArray();
  return undefined;
}

async function main(): Promise<void> {
  const { k, minDistance, outPath } = parseArgs(process.argv.slice(2));
  const entities = loadCatalog();
  const byId = new Map(entities.map((e) => [e.id, e]));

  // Current undirected adjacency from existing related[] (includes wave-1 edges).
  const degree = new Map<string, number>(entities.map((e) => [e.id, 0]));
  const existingPairs = new Set<string>();
  for (const e of entities) {
    for (const r of e.related ?? []) {
      const other = r.id;
      if (!byId.has(other)) continue;
      const key = pairKey(e.id, other);
      if (!existingPairs.has(key)) {
        existingPairs.add(key);
        degree.set(e.id, (degree.get(e.id) ?? 0) + 1);
        degree.set(other, (degree.get(other) ?? 0) + 1);
      }
    }
  }
  const isolated = new Set([...degree.entries()].filter(([, d]) => d === 0).map(([id]) => id));
  console.log(`Entities: ${entities.length} | existing edges: ${existingPairs.size} | isolated: ${isolated.size}`);

  const { app } = createServerFirebaseApp(process.env);
  const { getFirestore } = await import('firebase-admin/firestore');
  const firestore = getFirestore(app);
  const store = createAdminVectorIndexStore(firestore);
  const col = firestore.collection(ENTITY_EMBEDDINGS_COLLECTION);

  const side = (e: CatalogEntity) => ({ id: e.id, kind: e.kind, displayName: e.displayName ?? e.id, summary: clip(e.summary, 400), eraBuckets: e.eraBuckets ?? [] });
  const pairs = new Map<string, { pairKey: string; a: ReturnType<typeof side>; b: ReturnType<typeof side>; signals: { kind: string; distance: number }[] }>();

  let queried = 0, missing = 0;
  for (const entity of entities) {
    if (!isolated.has(entity.id)) continue; // target isolated nodes only
    const snap = await col.doc(entity.id).get();
    if (!snap.exists) { missing += 1; continue; }
    const vector = toVector((snap.data() ?? {})[VECTOR_FIELD_NAME]);
    if (!vector) { missing += 1; continue; }
    const matches = await store.findNearest({ queryVector: vector, limit: k + 1 });
    for (const m of matches) {
      if (m.entityId === entity.id || !byId.has(m.entityId)) continue;
      if (m.distance < minDistance) continue;
      const key = pairKey(entity.id, m.entityId);
      if (existingPairs.has(key)) continue; // already an edge
      const existing = pairs.get(key);
      if (existing) { existing.signals.push({ kind: 'vector', distance: m.distance }); continue; }
      pairs.set(key, { pairKey: key, a: side(entity), b: side(byId.get(m.entityId)!), signals: [{ kind: 'vector', distance: m.distance }] });
    }
    queried += 1;
    if (queried % 100 === 0) console.log(`  KNN progress: ${queried} isolated entities`);
  }

  const candidatePairs = [...pairs.values()].sort((x, y) => x.pairKey.localeCompare(y.pairKey));
  writeFileSync(outPath, JSON.stringify({ generatedFrom: 'wave-2 isolated-targeted KNN', params: { k, minDistance }, totals: { isolatedQueried: queried, missing, candidatePairs: candidatePairs.length }, pairs: candidatePairs }, null, 2));
  console.log(`\nWave-2: ${queried} isolated queried, ${missing} missing embeddings, ${candidatePairs.length} NEW candidate pairs -> ${outPath}`);
}

void main();
