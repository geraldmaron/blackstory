/**
 * Idempotent migrate runners for high-value Firestore collections → bb_* tables.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { countCollection, iterateCollection, iterateSubcollection } from './firestore-read.js';
import {
  mapActiveRelease,
  mapAcsCountyProfile,
  mapAcsTractProfile,
  mapAuditEvent,
  mapCanonicalEntityStub,
  mapCensusCountyDecade,
  mapCensusNationalDecade,
  mapCensusStateDecade,
  mapEntityEmbedding,
  mapEntityRelationship,
  mapEvidenceSource,
  mapHateCrimeCountyYear,
  mapHolcArea,
  mapIdempotencyKey,
  mapKillSwitch,
  mapMaterializedSnapshot,
  mapOpportunityAtlasTract,
  mapOutboxMessage,
  mapPolicyActive,
  mapPolicyVersion,
  mapPublicationRelease,
  mapReleaseEntity,
  mapReleaseGraphAdjacency,
  mapReleaseGraphAllTime,
  mapReleaseGraphDecade,
  mapReleaseStory,
  mapResearchCase,
  mapRetrievalEvent,
  mapSearchIndex,
  mapSourceCapture,
  mapSourceItem,
  mapStoryPacketReview,
  mapSubmission,
  mapUcrAgency,
  mapUcrStateParticipation,
} from './mappers/index.js';
import type { PgWriter } from './pg-writer.js';
import type { CollectionMigrateResult } from './util.js';
import { assertReleaseRowsDerivableFromCanonical } from './canonical-release-gate.js';

export type MigrateMode = 'dry-run' | 'apply';

export type MigrateOptions = {
  readonly db: Firestore;
  readonly writer?: PgWriter;
  readonly mode: MigrateMode;
  readonly limit?: number;
  readonly defaultReleaseId?: string;
};

function emptyResult(collection: string, target: string): CollectionMigrateResult {
  return { collection, target, read: 0, written: 0, skipped: 0, errors: [] };
}

async function flushUpsert(
  options: MigrateOptions,
  table: string,
  rows: Record<string, unknown>[],
  conflict: readonly string[],
  result: { written: number; errors: string[] },
  upsertOptions?: Parameters<PgWriter['upsertRows']>[3],
): Promise<void> {
  if (options.mode === 'dry-run' || !options.writer || rows.length === 0) {
    if (options.mode === 'dry-run') result.written += rows.length;
    rows.length = 0;
    return;
  }
  try {
    result.written += await options.writer.upsertRows(table, rows, conflict, upsertOptions);
  } catch (err) {
    result.errors.push(String(err instanceof Error ? err.message : err));
  }
  rows.length = 0;
}

async function flushCanonicalReleaseEntities(
  options: MigrateOptions,
  rows: Record<string, unknown>[],
  result: { written: number; errors: string[] },
): Promise<void> {
  if (rows.length === 0) return;
  if (options.mode === 'apply' && options.writer) {
    try {
      await assertReleaseRowsDerivableFromCanonical(
        options.writer,
        rows as unknown as Parameters<typeof assertReleaseRowsDerivableFromCanonical>[1],
      );
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      rows.length = 0;
      return;
    }
  }
  await flushUpsert(
    options,
    'bb_public.release_entities',
    rows,
    ['release_id', 'entity_id'],
    result,
  );
}

export async function migratePolicy(options: MigrateOptions): Promise<CollectionMigrateResult> {
  const result = { ...emptyResult('policy', 'bb_ops.policy_active'), errors: [] as string[] };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'policy')) {
    result.read += 1;
    const mapped = mapPolicyActive(doc.id, doc.data);
    if (!mapped) {
      result.skipped += 1;
      continue;
    }
    rows.push(mapped);
  }
  await flushUpsert(options, 'bb_ops.policy_active', rows, ['id'], result);
  return { ...result, errors: result.errors };
}

export async function migratePolicyVersions(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('policyVersions', 'bb_ops.policy_versions'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'policyVersions')) {
    result.read += 1;
    rows.push(mapPolicyVersion(doc.id, doc.data));
    if (rows.length >= 100) await flushUpsert(options, 'bb_ops.policy_versions', rows, ['id'], result);
  }
  await flushUpsert(options, 'bb_ops.policy_versions', rows, ['id'], result);
  return result;
}

export async function migrateKillSwitches(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('killSwitches', 'bb_ops.kill_switches'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'killSwitches')) {
    result.read += 1;
    rows.push(mapKillSwitch(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_ops.kill_switches', rows, ['id'], result);
  return result;
}

export async function migratePublicationReleases(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('publicationReleases', 'bb_publication.releases'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'publicationReleases')) {
    result.read += 1;
    rows.push(mapPublicationRelease(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_publication.releases', rows, ['id'], result);
  return result;
}

export async function migratePublicMeta(options: MigrateOptions): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('publicMeta', 'bb_public.active_release+materialized_snapshots'),
    errors: [] as string[],
  };
  const activeRows: Record<string, unknown>[] = [];
  const snapRows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'publicMeta')) {
    result.read += 1;
    if (doc.id === 'activeRelease') {
      activeRows.push(mapActiveRelease(doc.data));
    } else {
      const snap = mapMaterializedSnapshot(doc.id, doc.data);
      if (snap) snapRows.push(snap);
      else result.skipped += 1;
    }
  }
  await flushUpsert(options, 'bb_public.active_release', activeRows, ['id'], result);
  await flushUpsert(options, 'bb_public.materialized_snapshots', snapRows, ['name'], result);
  return result;
}

export async function migrateEvidenceSources(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('evidenceSources', 'bb_evidence.evidence_sources'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'evidenceSources')) {
    result.read += 1;
    rows.push(mapEvidenceSource(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_evidence.evidence_sources', rows, ['id'], result);
  return result;
}

export async function migrateSourceItems(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('sourceItems', 'bb_evidence.source_items'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'sourceItems')) {
    result.read += 1;
    rows.push(mapSourceItem(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_evidence.source_items', rows, ['id'], result);
  return result;
}

export async function migrateSourceCaptures(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('sourceCaptures', 'bb_evidence.source_captures'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'sourceCaptures')) {
    result.read += 1;
    rows.push(mapSourceCapture(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_evidence.source_captures', rows, ['id'], result);
  return result;
}

export async function migrateRetrievalEvents(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('retrievalEvents', 'bb_evidence.retrieval_events'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'retrievalEvents')) {
    result.read += 1;
    rows.push(mapRetrievalEvent(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_evidence.retrieval_events', rows, ['id'], result);
  return result;
}

export async function migrateResearchCases(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('researchCases', 'bb_research.cases'),
    errors: [] as string[],
  };
  const caseRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  const checklistRows: Record<string, unknown>[] = [];
  let n = 0;
  for await (const doc of iterateCollection(options.db, 'researchCases')) {
    result.read += 1;
    n += 1;
    if (options.limit !== undefined && n > options.limit) {
      result.skipped += 1;
      continue;
    }
    const mapped = mapResearchCase(doc.id, doc.data);
    caseRows.push(mapped.caseRow);
    historyRows.push(...mapped.history);
    checklistRows.push(...mapped.checklist);
    if (caseRows.length >= 50) {
      await flushUpsert(options, 'bb_research.cases', caseRows, ['id'], result);
    }
  }
  await flushUpsert(options, 'bb_research.cases', caseRows, ['id'], result);

  // Replace normalized children for migrated cases: delete+insert is safer for arrays.
  if (options.mode === 'apply' && options.writer) {
    try {
      if (historyRows.length > 0) {
        const caseIds = [...new Set(historyRows.map((r) => String(r.case_id)))];
        await options.writer.query(
          `DELETE FROM bb_research.case_history_events WHERE case_id = ANY($1::text[])`,
          [caseIds],
        );
        // Insert without natural PK — use serial; batch insert
        for (const row of historyRows) {
          await options.writer.query(
            `INSERT INTO bb_research.case_history_events
              (case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids, occurred_at, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              row.case_id,
              row.from_state,
              row.to_state,
              row.reason_code,
              row.reason ?? null,
              row.actor_id,
              row.evidence_ids ?? [],
              row.occurred_at,
              JSON.stringify(row.metadata ?? {}),
            ],
          );
        }
        result.written += historyRows.length;
      }
      if (checklistRows.length > 0) {
        const caseIds = [...new Set(checklistRows.map((r) => String(r.case_id)))];
        await options.writer.query(
          `DELETE FROM bb_research.case_checklist_items WHERE case_id = ANY($1::text[])`,
          [caseIds],
        );
        for (const row of checklistRows) {
          await options.writer.query(
            `INSERT INTO bb_research.case_checklist_items
              (case_id, key, complete, evidence_ids, note)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (case_id, key) DO UPDATE SET
               complete = EXCLUDED.complete,
               evidence_ids = EXCLUDED.evidence_ids,
               note = EXCLUDED.note`,
            [
              row.case_id,
              row.key,
              row.complete,
              row.evidence_ids ?? [],
              row.note ?? null,
            ],
          );
        }
        result.written += checklistRows.length;
      }
    } catch (err) {
      result.errors.push(String(err instanceof Error ? err.message : err));
    }
  } else {
    result.written += historyRows.length + checklistRows.length;
  }
  return result;
}

export async function migrateCensusNational(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('censusNationalDecades', 'bb_reference.census_national_decades'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'censusNationalDecades')) {
    result.read += 1;
    rows.push(mapCensusNationalDecade(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_reference.census_national_decades', rows, ['id'], result);
  return result;
}

export async function migrateCensusState(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('censusStateDecades', 'bb_reference.census_state_decades'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'censusStateDecades')) {
    result.read += 1;
    rows.push(mapCensusStateDecade(doc.id, doc.data));
    if (rows.length >= 100) {
      await flushUpsert(options, 'bb_reference.census_state_decades', rows, ['id'], result);
    }
  }
  await flushUpsert(options, 'bb_reference.census_state_decades', rows, ['id'], result);
  return result;
}

export async function migratePublicSearchIndex(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const defaultReleaseId = options.defaultReleaseId ?? 'rel_seed_001';
  const result = {
    ...emptyResult('publicSearchIndex', 'bb_public.search_index'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'publicSearchIndex')) {
    result.read += 1;
    rows.push(mapSearchIndex(doc.id, doc.data, defaultReleaseId));
    if (rows.length >= 100) {
      await flushUpsert(options, 'bb_public.search_index', rows, ['id'], result);
    }
  }
  await flushUpsert(options, 'bb_public.search_index', rows, ['id'], result);
  return result;
}

export async function migratePublicReleaseProjections(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('publicReleases/*', 'bb_public.release_entities+stories'),
    errors: [] as string[],
  };
  const releaseRefs = await options.db.collection('publicReleases').listDocuments();
  const entityRows: Record<string, unknown>[] = [];
  const storyRows: Record<string, unknown>[] = [];
  for (const ref of releaseRefs) {
    for await (const doc of iterateSubcollection(options.db, 'publicReleases', ref.id, 'entities')) {
      result.read += 1;
      entityRows.push(mapReleaseEntity(ref.id, doc.id, doc.data));
    }
    for await (const doc of iterateSubcollection(options.db, 'publicReleases', ref.id, 'stories')) {
      result.read += 1;
      storyRows.push(mapReleaseStory(ref.id, doc.id, doc.data));
    }
  }
  // Validate the complete entity set before the first public write. A malformed or divergent row
  // must not leave a partially accepted release merely because it appeared in a later batch.
  await flushCanonicalReleaseEntities(options, entityRows, result);
  await flushUpsert(options, 'bb_public.release_stories', storyRows, ['release_id', 'slug'], result);
  return result;
}

export async function migrateAuditEvents(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = { ...emptyResult('auditEvents', 'bb_audit.events'), errors: [] as string[] };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'auditEvents')) {
    result.read += 1;
    rows.push(mapAuditEvent(doc.id, doc.data));
    if (rows.length >= 100) await flushUpsert(options, 'bb_audit.events', rows, ['id'], result);
  }
  await flushUpsert(options, 'bb_audit.events', rows, ['id'], result);
  return result;
}

export async function migrateOutbox(options: MigrateOptions): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('outboxMessages', 'bb_ops.outbox_messages'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'outboxMessages')) {
    result.read += 1;
    rows.push(mapOutboxMessage(doc.id, doc.data));
    if (rows.length >= 100) await flushUpsert(options, 'bb_ops.outbox_messages', rows, ['id'], result);
  }
  await flushUpsert(options, 'bb_ops.outbox_messages', rows, ['id'], result);
  return result;
}

export async function migrateIdempotencyKeys(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('idempotencyKeys', 'bb_ops.idempotency_keys'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'idempotencyKeys')) {
    result.read += 1;
    rows.push(mapIdempotencyKey(doc.id, doc.data));
    if (rows.length >= 100) await flushUpsert(options, 'bb_ops.idempotency_keys', rows, ['key'], result);
  }
  await flushUpsert(options, 'bb_ops.idempotency_keys', rows, ['key'], result);
  return result;
}

export async function migrateSubmissions(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('submissionInbox', 'bb_submissions.intake_items'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'submissionInbox')) {
    result.read += 1;
    const mapped = mapSubmission(doc.id, doc.data);
    // created_by is uuid in Postgres — coerce invalid to nil uuid
    const createdBy = String(mapped.created_by);
    const uuidOk =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdBy);
    rows.push({
      ...mapped,
      created_by: uuidOk ? createdBy : '00000000-0000-0000-0000-000000000000',
    });
    if (rows.length >= 100) {
      await flushUpsert(options, 'bb_submissions.intake_items', rows, ['id'], result);
    }
  }
  await flushUpsert(options, 'bb_submissions.intake_items', rows, ['id'], result);
  return result;
}

export async function migrateStoryPacketReviews(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('adminStoryPacketReviews', 'bb_ops.story_packet_reviews'),
    errors: [] as string[],
  };
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'adminStoryPacketReviews')) {
    result.read += 1;
    rows.push(mapStoryPacketReview(doc.id, doc.data));
  }
  await flushUpsert(options, 'bb_ops.story_packet_reviews', rows, ['id'], result);
  return result;
}

export async function migratePublicReleaseGraph(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('publicReleases/graph*', 'bb_public.release_graph_*'),
    errors: [] as string[],
  };
  const releaseRefs = await options.db.collection('publicReleases').listDocuments();
  const adjacencyRows: Record<string, unknown>[] = [];
  const decadeRows: Record<string, unknown>[] = [];
  const allTimeRows: Record<string, unknown>[] = [];

  for (const ref of releaseRefs) {
    for await (const doc of iterateSubcollection(
      options.db,
      'publicReleases',
      ref.id,
      'graphAdjacency',
    )) {
      result.read += 1;
      adjacencyRows.push(mapReleaseGraphAdjacency(ref.id, doc.id, doc.data));
      if (adjacencyRows.length >= 100) {
        await flushUpsert(
          options,
          'bb_public.release_graph_adjacency',
          adjacencyRows,
          ['release_id', 'entity_id'],
          result,
        );
      }
    }
    for await (const doc of iterateSubcollection(
      options.db,
      'publicReleases',
      ref.id,
      'graphDecades',
    )) {
      result.read += 1;
      const mapped = mapReleaseGraphDecade(ref.id, doc.id, doc.data);
      if (!mapped) {
        result.skipped += 1;
        continue;
      }
      decadeRows.push(mapped);
    }
    const allTimeSnap = await options.db
      .collection('publicReleases')
      .doc(ref.id)
      .collection('graph')
      .doc('all-time')
      .get();
    if (allTimeSnap.exists) {
      result.read += 1;
      allTimeRows.push(
        mapReleaseGraphAllTime(ref.id, (allTimeSnap.data() ?? {}) as Record<string, unknown>),
      );
    }
  }

  await flushUpsert(
    options,
    'bb_public.release_graph_adjacency',
    adjacencyRows,
    ['release_id', 'entity_id'],
    result,
  );
  await flushUpsert(
    options,
    'bb_public.release_graph_decades',
    decadeRows,
    ['release_id', 'decade'],
    result,
  );
  await flushUpsert(options, 'bb_public.release_graph_all_time', allTimeRows, ['release_id'], result);
  return result;
}

async function ensureEntityStubs(
  options: MigrateOptions,
  stubs: Map<string, Record<string, unknown>>,
  result: { written: number; errors: string[] },
): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const [id, data] of stubs) {
    rows.push(mapCanonicalEntityStub(id, data));
    if (rows.length >= 100) {
      await flushUpsert(options, 'bb_canonical.entities', rows, ['id'], result, {
        doNothing: true,
      });
    }
  }
  await flushUpsert(options, 'bb_canonical.entities', rows, ['id'], result, { doNothing: true });
}

export async function migrateEntityRelationships(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('entityRelationships', 'bb_canonical.entity_relationships'),
    errors: [] as string[],
  };
  const stubs = new Map<string, Record<string, unknown>>();
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'entityRelationships')) {
    result.read += 1;
    const mapped = mapEntityRelationship(doc.id, doc.data);
    if (!mapped) {
      result.skipped += 1;
      continue;
    }
    stubs.set(mapped.from_entity_id, {});
    stubs.set(mapped.to_entity_id, {});
    rows.push(mapped);
    if (rows.length >= 100) {
      await ensureEntityStubs(options, stubs, result);
      stubs.clear();
      await flushUpsert(options, 'bb_canonical.entity_relationships', rows, ['id'], result);
    }
  }
  await ensureEntityStubs(options, stubs, result);
  await flushUpsert(options, 'bb_canonical.entity_relationships', rows, ['id'], result);
  return result;
}

export async function migrateEntityEmbeddings(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  const result = {
    ...emptyResult('entityEmbeddings', 'bb_canonical.entity_embeddings'),
    errors: [] as string[],
  };
  const stubs = new Map<string, Record<string, unknown>>();
  const rows: Record<string, unknown>[] = [];
  for await (const doc of iterateCollection(options.db, 'entityEmbeddings')) {
    result.read += 1;
    const mapped = mapEntityEmbedding(doc.id, doc.data);
    if (!mapped) {
      result.skipped += 1;
      continue;
    }
    stubs.set(mapped.entity_id, { kind: mapped.kind, displayName: mapped.entity_id });
    rows.push(mapped);
    if (rows.length >= 50) {
      await ensureEntityStubs(options, stubs, result);
      stubs.clear();
      await flushUpsert(options, 'bb_canonical.entity_embeddings', rows, ['entity_id'], result, {
        casts: { embedding: 'extensions.vector' },
      });
    }
  }
  await ensureEntityStubs(options, stubs, result);
  await flushUpsert(options, 'bb_canonical.entity_embeddings', rows, ['entity_id'], result, {
    casts: { embedding: 'extensions.vector' },
  });
  return result;
}

async function migrateProvenanceCollection(
  options: MigrateOptions,
  collection: string,
  table: string,
  conflict: readonly string[],
  mapRow: (id: string, data: Record<string, unknown>) => Record<string, unknown> | null,
  batchSize = 100,
): Promise<CollectionMigrateResult> {
  const result = { ...emptyResult(collection, table), errors: [] as string[] };
  const rows: Record<string, unknown>[] = [];
  let processed = 0;
  for await (const doc of iterateCollection(options.db, collection)) {
    result.read += 1;
    const mapped = mapRow(doc.id, doc.data);
    if (!mapped) {
      result.skipped += 1;
      continue;
    }
    rows.push(mapped);
    if (rows.length >= batchSize) {
      await flushUpsert(options, table, rows, conflict, result);
      processed += batchSize;
      if (processed % 5000 === 0) {
        console.error(JSON.stringify({ progress: collection, read: result.read, written: result.written }));
      }
    }
    if (options.limit !== undefined && result.read >= options.limit) break;
  }
  await flushUpsert(options, table, rows, conflict, result);
  return result;
}

export async function migrateCensusCounty(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'censusCountyDecades',
    'bb_reference.census_county_decades',
    ['id'],
    (id, data) => mapCensusCountyDecade(id, data),
  );
}

export async function migrateAcsCounty(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'acsCountyProfiles',
    'bb_reference.acs_county_profiles',
    ['id'],
    (id, data) => mapAcsCountyProfile(id, data),
  );
}

export async function migrateAcsTracts(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'acsTractProfiles',
    'bb_reference.acs_tract_profiles',
    ['id'],
    (id, data) => mapAcsTractProfile(id, data),
    50,
  );
}

export async function migrateUcrAgencies(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'ucrAgencies',
    'bb_reference.ucr_agencies',
    ['id'],
    (id, data) => mapUcrAgency(id, data),
  );
}

export async function migrateUcrStateParticipation(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'ucrStateParticipation',
    'bb_reference.ucr_state_participation',
    ['id'],
    (id, data) => mapUcrStateParticipation(id, data),
  );
}

export async function migrateOpportunityAtlas(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'opportunityAtlasTracts',
    'bb_reference.opportunity_atlas_tracts',
    ['id'],
    (id, data) => mapOpportunityAtlasTract(id, data),
    50,
  );
}

export async function migrateHateCrime(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'hateCrimeCountyYears',
    'bb_reference.hate_crime_county_years',
    ['id'],
    (id, data) => mapHateCrimeCountyYear(id, data),
  );
}

export async function migrateHolcAreas(
  options: MigrateOptions,
): Promise<CollectionMigrateResult> {
  return migrateProvenanceCollection(
    options,
    'holcAreas',
    'bb_reference.holc_areas',
    ['id'],
    (id, data) => mapHolcArea(id, data),
  );
}

export const HIGH_VALUE_MIGRANTS: readonly {
  readonly name: string;
  readonly run: (options: MigrateOptions) => Promise<CollectionMigrateResult>;
}[] = [
  { name: 'policy', run: migratePolicy },
  { name: 'policyVersions', run: migratePolicyVersions },
  { name: 'killSwitches', run: migrateKillSwitches },
  { name: 'publicationReleases', run: migratePublicationReleases },
  { name: 'publicMeta', run: migratePublicMeta },
  { name: 'evidenceSources', run: migrateEvidenceSources },
  { name: 'sourceItems', run: migrateSourceItems },
  { name: 'sourceCaptures', run: migrateSourceCaptures },
  { name: 'retrievalEvents', run: migrateRetrievalEvents },
  { name: 'researchCases', run: migrateResearchCases },
  { name: 'censusNationalDecades', run: migrateCensusNational },
  { name: 'censusStateDecades', run: migrateCensusState },
  { name: 'publicSearchIndex', run: migratePublicSearchIndex },
  { name: 'publicReleases', run: migratePublicReleaseProjections },
  { name: 'publicReleaseGraph', run: migratePublicReleaseGraph },
  { name: 'auditEvents', run: migrateAuditEvents },
  { name: 'outboxMessages', run: migrateOutbox },
  { name: 'idempotencyKeys', run: migrateIdempotencyKeys },
  { name: 'submissionInbox', run: migrateSubmissions },
  { name: 'adminStoryPacketReviews', run: migrateStoryPacketReviews },
];

export const LARGE_MIGRANTS: readonly {
  readonly name: string;
  readonly run: (options: MigrateOptions) => Promise<CollectionMigrateResult>;
}[] = [
  { name: 'entityRelationships', run: migrateEntityRelationships },
  { name: 'entityEmbeddings', run: migrateEntityEmbeddings },
  { name: 'censusCountyDecades', run: migrateCensusCounty },
  { name: 'acsCountyProfiles', run: migrateAcsCounty },
  { name: 'acsTractProfiles', run: migrateAcsTracts },
  { name: 'ucrAgencies', run: migrateUcrAgencies },
  { name: 'ucrStateParticipation', run: migrateUcrStateParticipation },
  { name: 'opportunityAtlasTracts', run: migrateOpportunityAtlas },
  { name: 'hateCrimeCountyYears', run: migrateHateCrime },
  { name: 'holcAreas', run: migrateHolcAreas },
];

export const ALL_MIGRANTS = [...HIGH_VALUE_MIGRANTS, ...LARGE_MIGRANTS] as const;

export async function runCensus(db: Firestore): Promise<
  readonly { readonly name: string; readonly count: number }[]
> {
  const { allKnownFirestoreCollections } = await import('./catalog.js');
  const names = allKnownFirestoreCollections();
  const rows: { name: string; count: number }[] = [];
  for (const name of names) {
    rows.push({ name, count: await countCollection(db, name) });
  }
  return rows;
}
