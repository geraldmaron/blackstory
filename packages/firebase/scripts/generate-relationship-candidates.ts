/**
 * WS3 (repo-fh8u.4) — candidate relationship generation, stage 1: PAIRS ONLY.
 *
 * Produces *candidate* entity pairs (never edges, never published) from two blind signals:
 *   1. Vector KNN (primary): each entity's stored embedding -> `findNearest` across ALL kinds
 *      (we WANT person<->event<->movement neighbors), self dropped, top-K kept with distance.
 *   2. Explicit mentions (deterministic): each entity's `mentionedEntityIds` -> pairs.
 *
 * Output is a staged JSON artifact keyed by unordered pair, carrying each side's context
 * (kind, displayName, trimmed summary, eraBuckets) and the signal(s) that surfaced it. The
 * downstream cheap-LLM proposal step (stage 2) assigns a typed, directed, evidence-cited edge
 * per docs/relationship-taxonomy.md; WS4 then validates + gates before anything is written back.
 *
 * Read-only against production Firestore (reads entityEmbeddings + runs KNN); writes nothing to
 * Firestore. Requires the same prod env as the backfill:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
 *   run-with-dev-secrets node --conditions development --import tsx \
 *     packages/firebase/scripts/generate-relationship-candidates.ts [--k 10] [--min-distance 0.55] [--out <path>]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerFirebaseApp } from '../src/server.js';
import { createAdminVectorIndexStore } from '../src/embeddings/vector-store.js';
import { ENTITY_EMBEDDINGS_COLLECTION, VECTOR_FIELD_NAME } from '../src/embeddings/constants.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type CatalogEntity = {
  readonly id: string;
  readonly kind: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly eraBuckets?: readonly string[];
  readonly mentionedEntityIds?: readonly string[];
};

type SideContext = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly eraBuckets: readonly string[];
};

type PairSignal =
  | { readonly kind: 'vector'; readonly distance: number }
  | { readonly kind: 'mention' };

type CandidatePair = {
  readonly pairKey: string;
  readonly a: SideContext;
  readonly b: SideContext;
  readonly signals: PairSignal[];
};

function parseArgs(argv: readonly string[]): {
  k: number;
  minDistance: number;
  outPath: string;
} {
  let k = 10;
  let minDistance = 0.55;
  let outPath = join(scriptDir, '../../../.cache/relationship-candidates.json');
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--k') k = Number(argv[++i]);
    else if (arg === '--min-distance') minDistance = Number(argv[++i]);
    else if (arg === '--out') outPath = resolve(argv[++i] ?? '');
  }
  if (!Number.isInteger(k) || k < 1) throw new Error('--k must be a positive integer');
  if (!(minDistance >= -1 && minDistance <= 1)) throw new Error('--min-distance must be in [-1,1]');
  return { k, minDistance, outPath };
}

/** Mirror of publish-national-catalog.ts loadCatalog(): top-level dir, .json only, no recursion. */
function loadCatalog(): CatalogEntity[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  const entities: CatalogEntity[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed as CatalogEntity[]) entities.push(entry);
  }
  return entities;
}

function trimSummary(summary: string | undefined): string {
  if (!summary) return '';
  return summary.length > 400 ? `${summary.slice(0, 397)}...` : summary;
}

function sideContext(entity: CatalogEntity): SideContext {
  return {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName ?? entity.id,
    summary: trimSummary(entity.summary),
    eraBuckets: entity.eraBuckets ?? [],
  };
}

function pairKeyFor(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/** Reads a stored VectorValue (admin SDK) or plain array into a number[]. */
function toVector(raw: unknown): number[] | undefined {
  if (Array.isArray(raw)) return raw as number[];
  if (raw && typeof (raw as { toArray?: () => number[] }).toArray === 'function') {
    return (raw as { toArray: () => number[] }).toArray();
  }
  return undefined;
}

async function main(): Promise<void> {
  const { k, minDistance, outPath } = parseArgs(process.argv.slice(2));

  const entities = loadCatalog();
  const byId = new Map<string, CatalogEntity>(entities.map((e) => [e.id, e]));
  console.log(`Loaded ${entities.length} catalog entities (${byId.size} unique ids)`);

  const { app } = createServerFirebaseApp(process.env);
  const { getFirestore } = await import('firebase-admin/firestore');
  const firestore = getFirestore(app);
  const store = createAdminVectorIndexStore(firestore);
  const embeddingsCollection = firestore.collection(ENTITY_EMBEDDINGS_COLLECTION);

  const pairs = new Map<string, CandidatePair>();

  function addSignal(idA: string, idB: string, signal: PairSignal): void {
    if (idA === idB) return;
    const a = byId.get(idA);
    const b = byId.get(idB);
    if (!a || !b) return; // only pair entities that exist in the published catalog
    const key = pairKeyFor(idA, idB);
    const existing = pairs.get(key);
    if (existing) {
      existing.signals.push(signal);
      return;
    }
    pairs.set(key, { pairKey: key, a: sideContext(a), b: sideContext(b), signals: [signal] });
  }

  // Signal 2 (deterministic): explicit mentions.
  let mentionPairs = 0;
  for (const entity of entities) {
    for (const mentionedId of entity.mentionedEntityIds ?? []) {
      if (byId.has(mentionedId)) {
        addSignal(entity.id, mentionedId, { kind: 'mention' });
        mentionPairs += 1;
      }
    }
  }
  console.log(`Mention signal: ${mentionPairs} raw mention pairs`);

  // Signal 1 (primary): vector KNN per entity.
  let missingEmbeddings = 0;
  let vectorEdges = 0;
  let processed = 0;
  for (const entity of entities) {
    const snap = await embeddingsCollection.doc(entity.id).get();
    if (!snap.exists) {
      missingEmbeddings += 1;
      continue;
    }
    const vector = toVector((snap.data() ?? {})[VECTOR_FIELD_NAME]);
    if (!vector) {
      missingEmbeddings += 1;
      continue;
    }
    const matches = await store.findNearest({ queryVector: vector, limit: k + 1 });
    for (const match of matches) {
      if (match.entityId === entity.id) continue; // drop self
      if (match.distance < minDistance) continue;
      addSignal(entity.id, match.entityId, { kind: 'vector', distance: match.distance });
      vectorEdges += 1;
    }
    processed += 1;
    if (processed % 100 === 0) console.log(`  KNN progress: ${processed} entities`);
  }
  console.log(
    `Vector signal: ${processed} entities queried, ${missingEmbeddings} missing embeddings, ${vectorEdges} neighbor hits (>=${minDistance})`,
  );

  const candidatePairs = [...pairs.values()].sort((x, y) => x.pairKey.localeCompare(y.pairKey));
  const entitiesCovered = new Set<string>();
  for (const pair of candidatePairs) {
    entitiesCovered.add(pair.a.id);
    entitiesCovered.add(pair.b.id);
  }

  const artifact = {
    generatedFrom: 'national-catalog fixtures + production entityEmbeddings',
    params: { k, minDistance },
    totals: {
      entities: entities.length,
      candidatePairs: candidatePairs.length,
      entitiesCovered: entitiesCovered.size,
      isolatedAfterCandidates: entities.length - entitiesCovered.size,
      missingEmbeddings,
    },
    pairs: candidatePairs,
  };
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  console.log('\n=== Candidate generation summary ===');
  console.log(`  candidate pairs: ${candidatePairs.length}`);
  console.log(
    `  entities covered by >=1 candidate: ${entitiesCovered.size}/${entities.length} (still isolated: ${entities.length - entitiesCovered.size})`,
  );
  console.log(`  entities missing an embedding: ${missingEmbeddings}`);
  console.log(`  wrote artifact: ${outPath}`);
}

void main();
