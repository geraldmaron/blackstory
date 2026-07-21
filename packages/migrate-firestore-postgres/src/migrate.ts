/**
 * Idempotent migrate runners for high-value Firestore collections → bb_* tables.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { countCollection, iterateCollection, iterateSubcollection } from './firestore-read.js';
import {
  mapActiveRelease,
  mapAuditEvent,
  mapCensusNationalDecade,
  mapCensusStateDecade,
  mapEvidenceSource,
  mapIdempotencyKey,
  mapKillSwitch,
  mapMaterializedSnapshot,
  mapOutboxMessage,
  mapPolicyActive,
  mapPolicyVersion,
  mapPublicationRelease,
  mapReleaseEntity,
  mapReleaseStory,
  mapResearchCase,
  mapRetrievalEvent,
  mapSearchIndex,
  mapSourceCapture,
  mapSourceItem,
  mapStoryPacketReview,
  mapSubmission,
} from './mappers/index.js';
import type { PgWriter } from './pg-writer.js';
import type { CollectionMigrateResult } from './util.js';

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
): Promise<void> {
  if (options.mode === 'dry-run' || !options.writer || rows.length === 0) {
    if (options.mode === 'dry-run') result.written += rows.length;
    rows.length = 0;
    return;
  }
  try {
    result.written += await options.writer.upsertRows(table, rows, conflict);
  } catch (err) {
    result.errors.push(String(err instanceof Error ? err.message : err));
  }
  rows.length = 0;
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
      if (entityRows.length >= 100) {
        await flushUpsert(
          options,
          'bb_public.release_entities',
          entityRows,
          ['release_id', 'entity_id'],
          result,
        );
      }
    }
    for await (const doc of iterateSubcollection(options.db, 'publicReleases', ref.id, 'stories')) {
      result.read += 1;
      storyRows.push(mapReleaseStory(ref.id, doc.id, doc.data));
    }
  }
  await flushUpsert(
    options,
    'bb_public.release_entities',
    entityRows,
    ['release_id', 'entity_id'],
    result,
  );
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
  { name: 'auditEvents', run: migrateAuditEvents },
  { name: 'outboxMessages', run: migrateOutbox },
  { name: 'idempotencyKeys', run: migrateIdempotencyKeys },
  { name: 'submissionInbox', run: migrateSubmissions },
  { name: 'adminStoryPacketReviews', run: migrateStoryPacketReviews },
];

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
