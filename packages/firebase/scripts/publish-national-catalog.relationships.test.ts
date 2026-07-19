/**
 * Offline regression tests for national-catalog relationship extraction used by
 * `publish-national-catalog.ts` — no Firestore or ADC required.
 *
 * Imports domain graph modules directly until `extractCatalogRelationships` and
 * `relatedEntriesFromRelationships` are re-exported from `@repo/domain` (the publish script
 * already imports those symbols from the barrel).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  buildGraphReleaseArtifact,
} from '../../domain/src/graph/build.ts';
import {
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
} from '../../domain/src/graph/catalog-related.ts';
import type { ReleaseSourceEntity } from '../../domain/src/publication/release-builder.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');
const generatedAt = '2026-07-18T00:00:00.000Z';

function loadCatalog(): ReleaseSourceEntity[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  const entries: ReleaseSourceEntity[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as ReleaseSourceEntity[];
    for (const entry of parsed) entries.push(entry);
  }
  return entries;
}

function activeSpansForCatalogEntry(entry: ReleaseSourceEntity) {
  if (entry.eraBuckets && entry.eraBuckets.length > 0) {
    const first = entry.eraBuckets[0]!;
    const last = entry.eraBuckets[entry.eraBuckets.length - 1]!;
    const startYear = first.slice(0, 4);
    const endYear = last.slice(0, 4);
    return [
      {
        validFrom: startYear,
        validTo: `${Number.parseInt(endYear, 10) + 9}`,
        datePrecision: 'year' as const,
      },
    ];
  }
  return [];
}

test('full national catalog yields related entries for Rosa Parks museum and Edmund Pettus bridge', () => {
  const entries = loadCatalog();
  const { relationships, skipped } = extractCatalogRelationships(entries, { generatedAt });

  assert.ok(relationships.length > 0, 'expected at least one canonical relationship');
  assert.equal(skipped.length, 0, `unexpected skipped pairs: ${skipped.join('; ')}`);

  const relatedByEntity = relatedEntriesFromRelationships(
    entries.map((entry) => entry.id),
    relationships,
  );

  // Exact counts grow as the catalog is enriched with more relationships, so assert the catalog
  // yields AT LEAST one related entry for each anchor entity rather than a brittle fixed count.
  assert.ok(
    (relatedByEntity.get('ent_rosa_parks_museum_001')?.length ?? 0) >= 1,
    'expected Rosa Parks museum to have at least one related entry',
  );
  assert.ok(
    (relatedByEntity.get('ent_edmund_pettus_bridge_001')?.length ?? 0) >= 1,
    'expected Edmund Pettus bridge to have at least one related entry',
  );

  const graphArtifact = buildGraphReleaseArtifact({
    releaseId: 'test-release',
    generatedAt,
    entityIds: entries.map((entry) => entry.id),
    entities: entries.map((entry) => ({
      entityId: entry.id,
      activeSpans: activeSpansForCatalogEntry(entry),
    })),
    relationships,
  });

  assert.ok(graphArtifact.adjacencyByEntityId.size > 0);
  assert.ok(graphArtifact.decadeViews.length > 0);
  assert.ok(graphArtifact.allTimeView.nodeIds.length > 0);
});
