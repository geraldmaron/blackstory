/**
 * Publish the national seed catalog (the related workstream follow-on: 100+ researched entities) into
 * the ACTIVE public release's projections + search index, relationship docs, and graph adjacency
 * artifacts, and emit ADR-004 catalog artifacts (`entities.json` + `search-index.json`) for
 * CDN/App Hosting reads.
 *
 * Reads every JSON file in `packages/firebase/fixtures/national-catalog/`, converts each
 * research entry into `publicEntityProjectionSchema`/`publicSearchIndexSchema`-conformant docs
 * via `@repo/domain`'s single release builder (`buildReleaseEntityArtifacts`,
 * packages/domain/src/publication/release-builder.ts — the related workstream), hard-fails if ANY
 * entry does not validate or does not resolve, then batch-writes:
 *   publicReleases/<activeRelease>/entities/<id>   (projection, merge)
 *   publicSearchIndex/<id>                          (search doc, merge)
 *   entityRelationships/<id>                        (canonical edge, merge)
 *   publicReleases/<activeRelease>/graphAdjacency/<id>
 *   publicReleases/<activeRelease>/graphDecades/<decade>
 *   publicReleases/<activeRelease>/graph/all-time
 *
 * Also writes local catalog artifacts under
 * `packages/firebase/fixtures/release-artifacts/` (and optionally uploads to the public-media
 * bucket when `APP_UPLOAD_RELEASE_ARTIFACTS=1`).
 *
 * Idempotent: re-running overwrites the same doc ids with the same content. Does NOT touch
 * `publicMeta/activeRelease` — the release pointer stays whatever bootstrap/promotion set.
 *
 * Requires:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Firestore write access
 *
 * Usage:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-national-catalog.ts
 *   DRY_RUN=1 ... — validate + print without writing.
 *   DRY_RUN=1 WRITE_LOCAL_ARTIFACTS=1 ... — validate and refresh local
 *     `packages/firebase/fixtures/release-artifacts/` only (no Firestore/GCS writes).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  buildGraphReleaseArtifact,
  buildReleaseEntityArtifacts,
  extractCatalogRelationships,
  publicGraphAdjacencyPath,
  publicGraphAllTimePath,
  publicGraphDecadePath,
  relatedEntriesFromRelationships,
  type DecadeBucketEntityInput,
  type EntityAdjacency,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { publicEntityProjectionSchema, publicSearchIndexSchema } from '../src/firestore/types.ts';
import {
  DEFAULT_PUBLIC_MEDIA_BUCKET,
  buildReleaseCatalogArtifacts,
  uploadReleaseCatalogArtifacts,
  writeReleaseCatalogArtifactsToDir,
} from '../src/firestore/release-artifacts.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const WRITE_LOCAL_ARTIFACTS = process.env.WRITE_LOCAL_ARTIFACTS === '1';
const UPLOAD_ARTIFACTS = process.env.APP_UPLOAD_RELEASE_ARTIFACTS === '1';
/** Geohash character precision for public anchors — matches the bootstrap fixtures' choice. */
const GEOHASH_PRECISION = 5;

if (!ALLOW && !DRY_RUN) {
  console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');
const artifactsRoot = join(scriptDir, '../fixtures/release-artifacts');

/** `ReleaseSourceEntity` (from `@repo/domain`'s release builder) mirrors this fixture format
 * 1:1 — see that type's doc comment. National-catalog JSON files parse directly into it. */

/**
 * === Publication gate wiring + single release builder (the related workstream, the related workstream) ===
 *
 * the related workstream first wired `@repo/domain`'s two fail-closed publish gates
 * (`facts/publish-gate.ts`'s no_citations floor, `relevance/notability-gate.ts`'s
 * notability-basis requirement) into this script, working around `CatalogEntry`'s thin shape
 * with an inline placeholder `notabilityBasis` proxy and per-claim `FactCitation` stand-ins (see
 * that bead's history for the full reasoning — still relevant background on WHY the
 * archived-capture citation-completeness sub-check remains unenforced: 0 of 1031 claims across
 * all 515 fixture entries carry `archivedUrl`/`archivedAt`/`accessedAt`, a genuine pipeline-wide
 * data gap, not a defect in specific entries).
 *
 * the related workstream extracted all of that gate wiring, notability-basis construction,
 * research-coverage computation, and projection/search-doc field assembly into `@repo/domain`'s
 * `buildReleaseEntityArtifacts` (packages/domain/src/publication/release-builder.ts) so this
 * fixture-driven publish path and any future canonical-graph-driven release build share exactly
 * one implementation — the bead's "search, map, facts, and entity pages all read the same
 * release" requirement starts with "the builder that produces the release is the same builder."
 * The placeholder notability-basis proxy is gone: `buildReleaseEntityArtifacts` derives a real,
 * claim-backed `notabilityBasis` from each entry's own claims. It also adds fail-closed reference
 * resolution (topicIds against `TOPIC_REGISTRY`, notabilityBasis evidenceIds against the entry's
 * own claim ids, non-empty jurisdiction/location fields) atop the pre-existing gates, all
 * surfaced through the same `{reason, message}` shape `main()`'s `writes` loop below reports.
 *
 * NOT in this pass (explicit deferral, not a silent drop): the "two independent lineages /
 * primary+corroborating source" gate for high-impact predicates (first/only/oldest, deaths,
 * violence, allegations) and the archived-capture citation-completeness sub-check both still need
 * a richer claim/evidence model than this fixture format carries. TODO(the related workstream follow-on).
 */
function loadCatalog(): ReleaseSourceEntity[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No catalog files found in ${catalogDir}`);
  }
  const entries: ReleaseSourceEntity[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(
      readFileSync(join(catalogDir, file), 'utf8'),
    ) as ReleaseSourceEntity[];
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed) entries.push(entry);
    console.log(`  ${file}: ${parsed.length} entries`);
  }
  return entries;
}

/** Maps catalog `eraBuckets` into decade-bucketing active spans (see `history-graph-seed.ts`). */
function activeSpansForCatalogEntry(
  entry: ReleaseSourceEntity,
): DecadeBucketEntityInput['activeSpans'] {
  if (entry.eraBuckets && entry.eraBuckets.length > 0) {
    const first = entry.eraBuckets[0]!;
    const last = entry.eraBuckets[entry.eraBuckets.length - 1]!;
    const startYear = first.slice(0, 4);
    const endYear = last.slice(0, 4);
    return [
      {
        validFrom: startYear,
        validTo: `${Number.parseInt(endYear, 10) + 9}`,
        datePrecision: 'year',
      },
    ];
  }
  return [];
}

function decadeBucketInputs(entries: readonly ReleaseSourceEntity[]): DecadeBucketEntityInput[] {
  return entries.map((entry) => ({
    entityId: entry.id,
    activeSpans: activeSpansForCatalogEntry(entry),
  }));
}

/** Firestore-friendly adjacency doc — mirrors `artifactPayload` in `graph/build.ts`. */
function adjacencyToFirestoreDoc(adjacency: EntityAdjacency): Record<string, unknown> {
  return {
    entityId: adjacency.entityId,
    totalCandidates: adjacency.totalCandidates,
    entries: adjacency.entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      direction: entry.direction,
      relationshipId: entry.relationshipId,
      evidenceCount: entry.evidenceCount,
      ...(entry.timespan
        ? {
            timespan: {
              ...(entry.timespan.label !== undefined ? { label: entry.timespan.label } : {}),
              ...(entry.timespan.validFrom !== undefined
                ? { validFrom: entry.timespan.validFrom }
                : {}),
              ...(entry.timespan.validTo !== undefined ? { validTo: entry.timespan.validTo } : {}),
            },
          }
        : {}),
    })),
  };
}

const SPOTLIGHT_ENTITY_IDS = ['ent_rosa_parks_museum_001', 'ent_edmund_pettus_bridge_001'] as const;

function logRelationshipSummary(
  relationshipCount: number,
  skippedCount: number,
  relatedByEntity: ReadonlyMap<string, readonly unknown[]>,
): void {
  const entitiesWithRelated = [...relatedByEntity.values()].filter(
    (entries) => entries.length > 0,
  ).length;
  console.log(
    `Relationships: ${relationshipCount} canonical edges (${skippedCount} skipped); ${entitiesWithRelated} entities with related > 0`,
  );
  for (const entityId of SPOTLIGHT_ENTITY_IDS) {
    const relatedCount = relatedByEntity.get(entityId)?.length ?? 0;
    console.log(`  ${entityId}: ${relatedCount} related entries`);
  }
}

async function main(): Promise<void> {
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Catalog: ${catalogDir}`);
  const entries = loadCatalog();

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate entity id in catalog: ${entry.id}`);
    ids.add(entry.id);
  }
  console.log(`Total: ${entries.length} unique entities`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  const activeSnap = await db.doc('publicMeta/activeRelease').get();
  const releaseId = activeSnap.data()?.releaseId as string | undefined;
  if (!releaseId) throw new Error('publicMeta/activeRelease missing or has no releaseId');
  console.log(`Active release: ${releaseId}`);

  // One real "this publish happened at this instant" timestamp for the whole run — every
  // entity's generatedAt/recordUpdatedAt below shares it, matching what an actual release
  // build does (see release-builder.ts's module doc comment on why this is legitimate here
  // and NOT legitimate at web read-time).
  const generatedAt = new Date().toISOString();

  const { relationships, skipped } = extractCatalogRelationships(entries, { generatedAt });
  console.log(`Extracted ${relationships.length} relationships (${skipped.length} skipped)`);
  if (skipped.length > 0) {
    for (const reason of skipped.slice(0, 10)) console.log(`  skipped: ${reason}`);
    if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more skipped pairs`);
  }

  const relatedByEntity = relatedEntriesFromRelationships(
    entries.map((entry) => entry.id),
    relationships,
  );
  logRelationshipSummary(relationships.length, skipped.length, relatedByEntity);

  const graphArtifact = buildGraphReleaseArtifact({
    releaseId,
    generatedAt,
    entityIds: entries.map((entry) => entry.id),
    entities: decadeBucketInputs(entries),
    relationships,
  });
  console.log(
    `Graph artifact: ${graphArtifact.adjacencyByEntityId.size} adjacency docs, ${graphArtifact.decadeViews.length} decade views, hash ${graphArtifact.contentHash.digest.slice(0, 12)}…`,
  );

  // Prefer canonical EntityLocation docs (Census-validated) over catalog lat/lng.
  // Then prefer git-durable national-catalog-location-overrides.json (survives API outages).
  const locationOverrides = new Map<
    string,
    {
      lat: number;
      lng: number;
      precision?: string;
      matchMethod?: string;
      locationLabel?: string;
    }
  >();

  const overridesPath = join(catalogDir, '../national-catalog-location-overrides.json');
  if (existsSync(overridesPath)) {
    const file = JSON.parse(readFileSync(overridesPath, 'utf8')) as {
      overrides?: Record<
        string,
        {
          lat: number;
          lng: number;
          precision?: string;
          matchMethod?: string;
        }
      >;
    };
    for (const [entityId, override] of Object.entries(file.overrides ?? {})) {
      locationOverrides.set(entityId, {
        lat: override.lat,
        lng: override.lng,
        ...(override.precision ? { precision: override.precision } : {}),
        ...(override.matchMethod ? { matchMethod: override.matchMethod } : {}),
      });
    }
    console.log(`Loaded ${locationOverrides.size} git-durable location overrides from fixture`);
  }

  let locationOverrideCount = 0;
  for (const entry of entries) {
    const locs = await db.collection(`canonicalEntities/${entry.id}/locations`).limit(5).get();
    if (locs.empty) continue;
    // Prefer current, then historical, then any doc with a point.
    const ranked = [...locs.docs].sort((a, b) => {
      const roleRank = (role: unknown) => (role === 'current' ? 0 : role === 'historical' ? 1 : 2);
      return roleRank(a.data().role) - roleRank(b.data().role);
    });
    for (const doc of ranked) {
      const data = doc.data();
      const point = data.point as { lat?: number; lng?: number } | undefined;
      const geometry = data.geometry as
        { type?: string; coordinates?: [number, number] } | undefined;
      const lat =
        typeof point?.lat === 'number'
          ? point.lat
          : geometry?.type === 'Point' && typeof geometry.coordinates?.[1] === 'number'
            ? geometry.coordinates[1]
            : undefined;
      const lng =
        typeof point?.lng === 'number'
          ? point.lng
          : geometry?.type === 'Point' && typeof geometry.coordinates?.[0] === 'number'
            ? geometry.coordinates[0]
            : undefined;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const match = data.match as { method?: string } | undefined;
      // Firestore EntityLocation wins over git overrides when present.
      locationOverrides.set(entry.id, {
        lat,
        lng,
        ...(typeof data.precision === 'string' ? { precision: data.precision } : {}),
        ...(typeof match?.method === 'string' ? { matchMethod: match.method } : {}),
        ...(typeof data.label === 'string' ? { locationLabel: data.label } : {}),
      });
      locationOverrideCount += 1;
      break;
    }
  }
  console.log(
    `EntityLocation Firestore overrides applied: ${locationOverrideCount}; ` +
      `total location overrides for publish: ${locationOverrides.size}`,
  );

  // Validate EVERYTHING before writing anything; name each failing entry so a bad catalog
  // line reads as "which record, which field", not a bare Zod trace. `buildReleaseEntityArtifacts`
  // (the single release builder, @repo/domain) runs the fact/notability gates and fail-closed
  // reference resolution; this script only re-validates the result against the Firestore-facing
  // Zod schemas (schema ownership stays in @repo/firebase, builder logic stays in @repo/domain).
  const failures: string[] = [];
  const writes = entries.flatMap((entry) => {
    try {
      const relatedEntries = relatedByEntity.get(entry.id);
      const locationOverride = locationOverrides.get(entry.id);
      const built = buildReleaseEntityArtifacts(entry, {
        releaseId,
        generatedAt,
        geohashPrecision: GEOHASH_PRECISION,
        ...(relatedEntries?.length ? { relatedEntries } : {}),
        ...(locationOverride ? { locationOverride } : {}),
      });
      if (!built.ok) {
        throw new Error(`${built.reason}: ${built.message}`);
      }
      const projection = publicEntityProjectionSchema.parse(built.projection);
      const search = publicSearchIndexSchema.parse(built.searchIndex);
      return [{ entry, projection, search }];
    } catch (error) {
      const detail =
        error instanceof Error && 'issues' in error
          ? JSON.stringify((error as { issues: unknown }).issues)
          : String(error);
      failures.push(`${entry.id}: ${detail}`);
      return [];
    }
  });
  if (failures.length > 0) {
    console.error(`INVALID ENTRIES (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    throw new Error(`${failures.length} catalog entries failed validation; nothing written.`);
  }
  console.log(`Validated ${writes.length} projections + ${writes.length} search docs`);

  const catalogArtifacts = buildReleaseCatalogArtifacts({
    releaseId,
    generatedAt,
    projections: writes.map((item) => item.projection),
    searchDocs: writes.map((item) => item.search),
  });
  console.log(
    `Catalog artifacts: ${catalogArtifacts.entitiesListPath} (${catalogArtifacts.entitiesListHash.digest.slice(0, 12)}…)`,
  );
  console.log(
    `Search artifacts: ${catalogArtifacts.searchIndexPath} (${catalogArtifacts.searchIndexHash.digest.slice(0, 12)}…)`,
  );

  if (DRY_RUN) {
    for (const { projection } of writes.slice(0, 5)) {
      console.log(`  sample: ${projection.id} — ${projection.displayName} (${projection.kind})`);
    }
    logRelationshipSummary(relationships.length, skipped.length, relatedByEntity);
    if (WRITE_LOCAL_ARTIFACTS) {
      const written = writeReleaseCatalogArtifactsToDir(catalogArtifacts, artifactsRoot);
      console.log(
        `Wrote local artifacts (dry-run, no Firestore/GCS):\n  ${written.entitiesListFile}\n  ${written.searchIndexFile}`,
      );
    }
    console.log('Dry run complete; nothing written to Firestore/GCS.');
    return;
  }

  // Firestore batches cap at 500 ops; chunk defensively.
  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  let relationshipWrites = 0;
  let adjacencyWrites = 0;
  let decadeWrites = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };
  const queueMerge = async (path: string, data: Record<string, unknown>) => {
    batch.set(db.doc(path), data, { merge: true });
    ops += 1;
    if (ops >= BATCH_LIMIT) await flush();
  };

  for (const { projection, search } of writes) {
    await queueMerge(`publicReleases/${releaseId}/entities/${projection.id}`, projection);
    await queueMerge(`publicSearchIndex/${search.id}`, search);
  }

  for (const relationship of relationships) {
    await queueMerge(`entityRelationships/${relationship.id}`, { ...relationship });
    relationshipWrites += 1;
  }

  for (const [entityId, adjacency] of graphArtifact.adjacencyByEntityId) {
    await queueMerge(
      publicGraphAdjacencyPath(releaseId, entityId),
      adjacencyToFirestoreDoc(adjacency),
    );
    adjacencyWrites += 1;
  }

  for (const decadeView of graphArtifact.decadeViews) {
    await queueMerge(publicGraphDecadePath(releaseId, decadeView.decade), {
      decade: decadeView.decade,
      nodeIds: [...decadeView.nodeIds],
      edgeIds: [...decadeView.edgeIds],
    });
    decadeWrites += 1;
  }

  await queueMerge(publicGraphAllTimePath(releaseId), {
    nodeIds: [...graphArtifact.allTimeView.nodeIds],
    edgeIds: [...graphArtifact.allTimeView.edgeIds],
  });

  await flush();

  const written = writeReleaseCatalogArtifactsToDir(catalogArtifacts, artifactsRoot);
  console.log(
    `Wrote local artifacts:\n  ${written.entitiesListFile}\n  ${written.searchIndexFile}`,
  );

  if (UPLOAD_ARTIFACTS) {
    const bucket = getStorage().bucket(DEFAULT_PUBLIC_MEDIA_BUCKET);
    await uploadReleaseCatalogArtifacts({
      artifacts: catalogArtifacts,
      save: async (objectPath, body, contentType) => {
        await bucket.file(objectPath).save(body, {
          contentType,
          resumable: false,
          metadata: {
            cacheControl: 'public, max-age=300, stale-while-revalidate=86400',
          },
        });
      },
    });
    console.log(
      `Uploaded artifacts to gs://${DEFAULT_PUBLIC_MEDIA_BUCKET}/public/releases/${releaseId}/`,
    );
  } else {
    console.log('Skipped GCS upload (set APP_UPLOAD_RELEASE_ARTIFACTS=1 to upload).');
  }

  // Prefer write-count verification over a post-publish full collection scan (read-cost).
  console.log(
    `Publish complete. Wrote ${writes.length} entity projections + ${writes.length} search docs, ` +
      `${relationshipWrites} relationships, ${adjacencyWrites} adjacency docs, ${decadeWrites} decade views, ` +
      `and 1 all-time view for ${releaseId}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
