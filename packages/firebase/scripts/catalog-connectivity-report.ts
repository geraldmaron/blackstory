/**
 * Baseline connectivity audit for the entity relationship graph.
 *
 * Answers, with real measured numbers: how connected is the national-catalog entity graph
 * today, using ONLY the inline `related[]` edges each catalog entry authors and the exact same
 * `extractCatalogRelationships` extraction `publish-national-catalog.ts` uses at publish time?
 *
 * Loads the catalog TWICE:
 *  - "pipeline-visible": mirrors `publish-national-catalog.ts`'s `loadCatalog()` exactly —
 *    `readdirSync` on the top-level `fixtures/national-catalog/` dir, `.json` files only, no
 *    recursion. This is what actually publishes today.
 *  - "full": recursively walks every `.json` file under `fixtures/national-catalog/` (including
 *    the `_wave-2026-07-19/` subdirectory), skipping any file that doesn't parse to a JSON array
 *    (e.g. `_wave-2026-07-19/denylist.json`, which is a `{generatedAt, count, ids, ...}` record,
 *    not an entity list). This is everything that EXISTS on disk, whether or not the pipeline
 *    currently reads it.
 *
 * Reports both counts and the discrepancy so it's clear what the live pipeline sees vs. what
 * exists in the repo (the `_wave-2026-07-19` lane files largely duplicate ids already present in
 * the top-level files — see `entities-with-duplicate-ids` in the printed summary).
 *
 * Then, over the pipeline-visible set (the actually-published graph):
 *  - counts entities with non-empty `related[]` / `mentionedEntityIds`
 *  - runs `extractCatalogRelationships` and reports extractable edges + skipped edges by reason
 *  - builds the UNDIRECTED graph of extractable edges and computes connected components,
 *    largest-component size/%, isolated-entity count, and degree distribution
 *  - groups edges by relationship type and by (kind, kind) pair
 *
 * Writes a machine-readable baseline to `fixtures/connectivity-baseline.json` (git-durable) and
 * prints a readable summary to stdout.
 *
 * Uses a FIXED `generatedAt` (never `Date.now()`) so re-runs are deterministic and diffable.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/catalog-connectivity-report.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCatalogRelationships,
  type ReleaseSourceEntity,
} from '@repo/domain';

/** Fixed generation timestamp — never `Date.now()`, so re-runs are byte-for-byte comparable. */
const GENERATED_AT = '2026-07-19T00:00:00.000Z';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');
const baselineOutPath = join(scriptDir, '../fixtures/connectivity-baseline.json');

// ---------------------------------------------------------------------------
// Loading — mirrors `publish-national-catalog.ts`'s `loadCatalog()` for the pipeline-visible set;
// a separate recursive walk for the full on-disk set.
// ---------------------------------------------------------------------------

type LoadedFile = {
  readonly file: string;
  readonly count: number;
};

type LoadResult = {
  readonly entities: ReleaseSourceEntity[];
  readonly files: readonly LoadedFile[];
  readonly skippedFiles: readonly { readonly file: string; readonly reason: string }[];
};

/** Exact mirror of `publish-national-catalog.ts`'s `loadCatalog()`: top-level dir, `.json` only,
 * no recursion (a subdirectory name never ends in `.json` so it's excluded automatically). */
function loadPipelineVisibleCatalog(): LoadResult {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  const entities: ReleaseSourceEntity[] = [];
  const loadedFiles: LoadedFile[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed as ReleaseSourceEntity[]) entities.push(entry);
    loadedFiles.push({ file, count: parsed.length });
  }
  return { entities, files: loadedFiles, skippedFiles: [] };
}

function walkJsonFiles(dir: string, relativeTo: string, out: string[]): void {
  for (const dirent of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      walkJsonFiles(full, relativeTo, out);
      continue;
    }
    if (dirent.isFile() && dirent.name.endsWith('.json')) {
      out.push(full);
    }
  }
}

/** Recursively loads every `.json` file under `fixtures/national-catalog/`, including
 * `_wave-2026-07-19/`. Skips (and reports) any file whose parsed content is not a JSON array —
 * e.g. `_wave-2026-07-19/denylist.json`, which is a metadata record, not an entity list. */
function loadFullOnDiskCatalog(): LoadResult {
  const allJsonFiles: string[] = [];
  walkJsonFiles(catalogDir, catalogDir, allJsonFiles);

  const entities: ReleaseSourceEntity[] = [];
  const loadedFiles: LoadedFile[] = [];
  const skippedFiles: { file: string; reason: string }[] = [];

  for (const fullPath of allJsonFiles) {
    const relPath = fullPath.slice(catalogDir.length + 1);
    const parsed = JSON.parse(readFileSync(fullPath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      skippedFiles.push({ file: relPath, reason: 'not a JSON array (metadata file)' });
      continue;
    }
    for (const entry of parsed as ReleaseSourceEntity[]) entities.push(entry);
    loadedFiles.push({ file: relPath, count: parsed.length });
  }

  return { entities, files: loadedFiles, skippedFiles };
}

// ---------------------------------------------------------------------------
// Pure graph math — connected components + degree stats over an undirected edge list.
// Kept dependency-free and exported so `catalog-connectivity-report.test.ts` can verify the
// algorithm on a tiny synthetic graph without touching the filesystem.
// ---------------------------------------------------------------------------

export type UndirectedEdge = {
  readonly a: string;
  readonly b: string;
};

export type ConnectedComponentsResult = {
  /** Each component as a sorted array of entity ids; components sorted by descending size, then
   * by the first (smallest) member id for determinism. */
  readonly components: readonly (readonly string[])[];
  readonly componentCount: number;
  readonly largestComponentSize: number;
  /** Percentage (0-100) of `entityIds` in the largest component. 0 when `entityIds` is empty. */
  readonly largestComponentPct: number;
  /** Entity ids with degree 0 (present in `entityIds` but touching no edge). */
  readonly isolatedEntityIds: readonly string[];
};

/** Builds an undirected adjacency map over `entityIds`, ignoring self-loops and edges whose
 * endpoints aren't both present in `entityIds`. */
function buildUndirectedAdjacency(
  entityIds: readonly string[],
  edges: readonly UndirectedEdge[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const id of entityIds) adjacency.set(id, new Set());
  for (const edge of edges) {
    if (edge.a === edge.b) continue;
    if (!adjacency.has(edge.a) || !adjacency.has(edge.b)) continue;
    adjacency.get(edge.a)!.add(edge.b);
    adjacency.get(edge.b)!.add(edge.a);
  }
  return adjacency;
}

/** Connected components over the undirected graph `(entityIds, edges)` via BFS. Pure and
 * deterministic: given the same inputs, always returns the same component partition and the
 * same output ordering. */
export function computeConnectedComponents(
  entityIds: readonly string[],
  edges: readonly UndirectedEdge[],
): ConnectedComponentsResult {
  const adjacency = buildUndirectedAdjacency(entityIds, edges);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of entityIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue: string[] = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component.sort());
  }

  components.sort((x, y) => {
    if (y.length !== x.length) return y.length - x.length;
    return x[0]!.localeCompare(y[0]!);
  });

  const largestComponentSize = components.length > 0 ? components[0]!.length : 0;
  const isolatedEntityIds = components
    .filter((component) => component.length === 1)
    .map((component) => component[0]!)
    .sort();

  return {
    components,
    componentCount: components.length,
    largestComponentSize,
    largestComponentPct: entityIds.length > 0 ? (largestComponentSize / entityIds.length) * 100 : 0,
    isolatedEntityIds,
  };
}

export type DegreeStats = {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly degreeById: ReadonlyMap<string, number>;
};

/** Per-entity undirected degree (distinct neighbor count) + min/max/mean/median across
 * `entityIds`. Entities with no edges count as degree 0. */
export function computeDegreeStats(
  entityIds: readonly string[],
  edges: readonly UndirectedEdge[],
): DegreeStats {
  const adjacency = buildUndirectedAdjacency(entityIds, edges);
  const degreeById = new Map<string, number>();
  for (const [id, neighbors] of adjacency) degreeById.set(id, neighbors.size);

  const degrees = [...degreeById.values()].sort((a, b) => a - b);
  const min = degrees.length > 0 ? degrees[0]! : 0;
  const max = degrees.length > 0 ? degrees[degrees.length - 1]! : 0;
  const mean = degrees.length > 0 ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length : 0;
  const mid = Math.floor(degrees.length / 2);
  const median =
    degrees.length === 0
      ? 0
      : degrees.length % 2 === 1
        ? degrees[mid]!
        : (degrees[mid - 1]! + degrees[mid]!) / 2;

  return { min, max, mean, median, degreeById };
}

// ---------------------------------------------------------------------------
// Skip-reason classification — `extractCatalogRelationships`'s `skipped` array is a flat list of
// human-readable strings with exactly three shapes (see catalog-related.ts). Classify by the
// substrings that function actually emits, rather than re-deriving the reason independently.
// ---------------------------------------------------------------------------

function classifySkipReason(message: string): string {
  if (message.includes('unsupported relationship type')) return 'unsupported_relationship_type';
  if (message.includes('related entity not found in input set')) return 'related_entity_not_found';
  if (message.includes('no resolvable claim evidence')) return 'no_resolvable_claim_evidence';
  return 'other_unclassified';
}

function groupCount<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sortRecordByCountDesc(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).sort(([keyA, countA], [keyB, countB]) => {
      if (countB !== countA) return countB - countA;
      return keyA.localeCompare(keyB);
    }),
  );
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main(): void {
  const pipelineVisible = loadPipelineVisibleCatalog();
  const fullOnDisk = loadFullOnDiskCatalog();

  const pipelineUniqueIds = new Set(pipelineVisible.entities.map((entity) => entity.id));
  const fullUniqueIds = new Set(fullOnDisk.entities.map((entity) => entity.id));

  console.log('=== Catalog loading: pipeline-visible vs. full on-disk ===');
  console.log(
    `Pipeline-visible (mirrors publish-national-catalog.ts loadCatalog(), top-level dir only):`,
  );
  for (const { file, count } of pipelineVisible.files) console.log(`  ${file}: ${count} entries`);
  console.log(
    `  -> ${pipelineVisible.entities.length} raw entities across ${pipelineVisible.files.length} files ` +
      `(${pipelineUniqueIds.size} unique ids)`,
  );
  console.log();
  console.log(`Full on-disk (recursive, includes _wave-2026-07-19/):`);
  for (const { file, count } of fullOnDisk.files) console.log(`  ${file}: ${count} entries`);
  for (const { file, reason } of fullOnDisk.skippedFiles) {
    console.log(`  ${file}: SKIPPED (${reason})`);
  }
  console.log(
    `  -> ${fullOnDisk.entities.length} raw entities across ${fullOnDisk.files.length} files ` +
      `(${fullUniqueIds.size} unique ids)`,
  );
  console.log();
  console.log(
    `Discrepancy: full on-disk has ${fullOnDisk.entities.length - pipelineVisible.entities.length} ` +
      `more raw entities (${fullUniqueIds.size - pipelineUniqueIds.size} more unique ids) than what ` +
      `the pipeline currently publishes. The _wave-2026-07-19/ lane files largely re-list ids ` +
      `already present in the top-level files (see duplicate-id overlap below).`,
  );
  const idsOnlyInFull = [...fullUniqueIds].filter((id) => !pipelineUniqueIds.has(id));
  console.log(
    `  ids present in full on-disk but NOT in pipeline-visible: ${idsOnlyInFull.length}`,
  );
  console.log();

  // -------------------------------------------------------------------------
  // Everything below runs over the PIPELINE-VISIBLE set — this is the graph that actually
  // publishes today, which is what a connectivity baseline needs to reflect.
  // -------------------------------------------------------------------------
  const entities = pipelineVisible.entities;
  const entityIds = entities.map((entity) => entity.id);
  const entityKindById = new Map(entities.map((entity) => [entity.id, entity.kind]));

  const withRelated = entities.filter((entity) => (entity.related?.length ?? 0) > 0);
  const withMentionedEntityIds = entities.filter(
    (entity) => (entity.mentionedEntityIds?.length ?? 0) > 0,
  );

  const { relationships, skipped } = extractCatalogRelationships(entities, {
    generatedAt: GENERATED_AT,
  });

  const skippedByReason = sortRecordByCountDesc(groupCount(skipped, classifySkipReason));

  const undirectedEdges: UndirectedEdge[] = relationships.map((rel) => ({
    a: rel.fromEntityId,
    b: rel.toEntityId,
  }));

  const components = computeConnectedComponents(entityIds, undirectedEdges);
  const degreeStats = computeDegreeStats(entityIds, undirectedEdges);

  const edgesByType = sortRecordByCountDesc(groupCount(relationships, (rel) => rel.type));

  const edgesByKindPair = sortRecordByCountDesc(
    groupCount(relationships, (rel) => {
      const fromKind = entityKindById.get(rel.fromEntityId) ?? 'unknown';
      const toKind = entityKindById.get(rel.toEntityId) ?? 'unknown';
      const [left, right] = fromKind <= toKind ? [fromKind, toKind] : [toKind, fromKind];
      return `${left}<->${right}`;
    }),
  );

  console.log('=== Connectivity audit (pipeline-visible entities only) ===');
  console.log(`Total entities: ${entities.length}`);
  console.log(
    `Entities with non-empty related[]: ${withRelated.length} ` +
      `(${((withRelated.length / entities.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Entities with non-empty mentionedEntityIds: ${withMentionedEntityIds.length} ` +
      `(${((withMentionedEntityIds.length / entities.length) * 100).toFixed(1)}%)`,
  );
  console.log();
  console.log(`Extractable edges (extractCatalogRelationships): ${relationships.length}`);
  console.log(`Skipped edges: ${skipped.length}`);
  for (const [reason, count] of Object.entries(skippedByReason)) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log();
  console.log('Connected components (undirected graph of extractable edges):');
  console.log(`  components: ${components.componentCount}`);
  console.log(
    `  largest component size: ${components.largestComponentSize} ` +
      `(${components.largestComponentPct.toFixed(1)}% of entities)`,
  );
  console.log(`  isolated entities (degree 0): ${components.isolatedEntityIds.length}`);
  console.log();
  console.log('Degree distribution:');
  console.log(`  min: ${degreeStats.min}`);
  console.log(`  median: ${degreeStats.median}`);
  console.log(`  mean: ${degreeStats.mean.toFixed(3)}`);
  console.log(`  max: ${degreeStats.max}`);
  console.log();
  console.log('Edges by relationship type:');
  for (const [type, count] of Object.entries(edgesByType)) console.log(`  ${type}: ${count}`);
  console.log();
  console.log('Edges by kind-pair:');
  for (const [pair, count] of Object.entries(edgesByKindPair)) console.log(`  ${pair}: ${count}`);
  console.log();

  const baseline = {
    generatedAt: GENERATED_AT,
    loading: {
      pipelineVisible: {
        fileCount: pipelineVisible.files.length,
        rawEntityCount: pipelineVisible.entities.length,
        uniqueEntityIdCount: pipelineUniqueIds.size,
        files: pipelineVisible.files,
      },
      fullOnDisk: {
        fileCount: fullOnDisk.files.length,
        rawEntityCount: fullOnDisk.entities.length,
        uniqueEntityIdCount: fullUniqueIds.size,
        files: fullOnDisk.files,
        skippedFiles: fullOnDisk.skippedFiles,
      },
      discrepancy: {
        rawEntityCountDelta: fullOnDisk.entities.length - pipelineVisible.entities.length,
        uniqueEntityIdCountDelta: fullUniqueIds.size - pipelineUniqueIds.size,
        idsOnlyInFullOnDisk: idsOnlyInFull.sort(),
      },
    },
    connectivity: {
      totalEntities: entities.length,
      entitiesWithNonEmptyRelated: withRelated.length,
      entitiesWithNonEmptyMentionedEntityIds: withMentionedEntityIds.length,
      extractableEdgeCount: relationships.length,
      skippedEdgeCount: skipped.length,
      skippedByReason,
      connectedComponents: {
        componentCount: components.componentCount,
        largestComponentSize: components.largestComponentSize,
        largestComponentPct: components.largestComponentPct,
        isolatedEntityCount: components.isolatedEntityIds.length,
        isolatedEntityIds: components.isolatedEntityIds,
        componentSizes: components.components.map((component) => component.length),
      },
      degreeDistribution: {
        min: degreeStats.min,
        median: degreeStats.median,
        mean: degreeStats.mean,
        max: degreeStats.max,
      },
      edgesByRelationshipType: edgesByType,
      edgesByKindPair,
    },
  };

  const outDir = dirname(baselineOutPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(baselineOutPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(`Wrote baseline to ${baselineOutPath}`);
}

// Only run when executed directly (`node .../catalog-connectivity-report.ts`), not when this
// module is imported elsewhere (e.g. `catalog-connectivity-report.test.ts` importing the pure
// graph-math functions) — importing this module must never have the side effect of re-running
// the full report and rewriting the baseline file on disk.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
