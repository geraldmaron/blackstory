/**
 * Dataset-acquisition provenance — the bridge between external dataset ingestion and the
 * EXISTING evidence-provenance harness (`evidenceSources` → `sourceItems` →
 * `retrievalEvents` → `sourceCaptures`, schemas in ../firestore/types.ts).
 *
 * Correction 2026-07-18: the first tier-1 ingest scripts recorded dataset-level provenance
 * ad hoc (`datasetChecksum` field + .sha256 sidecar only). Bead the related workstream's contract is
 * explicit — "ingestion provenance = RetrievalEvent/SourceCapture (contentHash) + source
 * registry" — so every dataset acquisition now ALSO writes the harness documents through
 * this helper. The sidecar and per-doc `datasetChecksum` stay (belt-and-braces at the
 * artifact and doc level); the capture chain is the queryable system of record.
 *
 * Deterministic ids keyed on registry id + content hash make re-recording the same
 * acquisition a no-op upsert, matching the loaders' idempotency discipline.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { rightsPolicyForVerdict, type ExternalDataSource } from '@repo/domain';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import { setPreservingCreatedAt } from './batch-upsert.js';
import {
  evidenceSourceSchema,
  retrievalEventSchema,
  sourceCaptureSchema,
  sourceItemSchema,
} from '../firestore/types.js';

export type DatasetAcquisitionInput = {
  readonly firestore: Firestore;
  /** The external-data-sources registry entry this acquisition belongs to. */
  readonly registryEntry: ExternalDataSource;
  /** sha256 hex digest of the acquired artifact (becomes the capture contentHash). */
  readonly contentHashHex: string;
  readonly retrievedAt: string;
  /** `gs://bucket/path` of the archived raw artifact; omit for API pulls with no snapshot. */
  readonly snapshotStorageObject?: string;
  /** Parser/loader version string recorded on the retrieval event and capture. */
  readonly parserVersion: string;
  readonly httpStatus?: number;
};

export type DatasetAcquisitionRecord = {
  readonly evidenceSourceId: string;
  readonly sourceItemId: string;
  readonly retrievalEventId: string;
  readonly sourceCaptureId?: string;
};

/** Records one dataset acquisition through the evidence-provenance chain. Idempotent. */
export async function recordDatasetAcquisition(
  input: DatasetAcquisitionInput,
): Promise<DatasetAcquisitionRecord> {
  const { firestore, registryEntry } = input;
  const adapterId = `external-data:${registryEntry.id}`;
  const hash8 = input.contentHashHex.slice(0, 8);
  const evidenceSourceId = `src_external_${registryEntry.id.replace(/-/g, '_')}`;
  const sourceItemId = `item_${registryEntry.id.replace(/-/g, '_')}`;
  const retrievalEventId = `ret_${registryEntry.id.replace(/-/g, '_')}_${hash8}`;
  const sourceCaptureId = `cap_${registryEntry.id.replace(/-/g, '_')}_${hash8}`;
  const now = input.retrievedAt;

  const evidenceSource = evidenceSourceSchema.parse({
    id: evidenceSourceId,
    displayName: registryEntry.displayName,
    classification: 'published_dataset',
    adapterId,
    stableIdScheme: 'dataset-artifact-url',
    policy: {
      snapshotMode: input.snapshotStorageObject ? 'selective' : 'none',
      rights: rightsPolicyForVerdict(registryEntry.license.verdict),
      refreshSchedule: registryEntry.cadence,
      notes: `${registryEntry.license.name}. Registry: external-data-sources.ts#${registryEntry.id}`,
    },
    adapterEnabled: false,
    createdAt: now,
    updatedAt: now,
  });

  const sourceItem = sourceItemSchema.parse({
    id: sourceItemId,
    sourceId: evidenceSourceId,
    stableIdentifier: registryEntry.dataUrl,
    canonicalUrl: registryEntry.dataUrl,
    title: `${registryEntry.displayName} (${registryEntry.vintage})`,
    classification: 'dataset_artifact',
    createdAt: now,
    updatedAt: now,
  });

  const retrievalEvent = retrievalEventSchema.parse({
    id: retrievalEventId,
    sourceId: evidenceSourceId,
    sourceItemId,
    adapterId,
    startedAt: now,
    completedAt: now,
    status: 'success',
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
    parserVersion: input.parserVersion,
  });

  // Preserve createdAt on the upsertable docs; event/capture docs are append-once by id.
  await setPreservingCreatedAt(firestore, FIRESTORE_ROOT.evidenceSources, evidenceSource);
  await setPreservingCreatedAt(firestore, FIRESTORE_ROOT.sourceItems, sourceItem);
  await firestore
    .collection(FIRESTORE_ROOT.retrievalEvents)
    .doc(retrievalEventId)
    .set(retrievalEvent);

  if (!input.snapshotStorageObject) {
    return { evidenceSourceId, sourceItemId, retrievalEventId };
  }

  const sourceCapture = sourceCaptureSchema.parse({
    id: sourceCaptureId,
    sourceItemId,
    sourceId: evidenceSourceId,
    contentHash: { algorithm: 'sha256', digest: input.contentHashHex },
    parserVersion: input.parserVersion,
    retrievedAt: now,
    retrievalEventId,
    snapshotStorageObject: input.snapshotStorageObject,
    snapshotMode: 'selective',
    createdAt: now,
  });
  await firestore.collection(FIRESTORE_ROOT.sourceCaptures).doc(sourceCaptureId).set(sourceCapture);

  return { evidenceSourceId, sourceItemId, retrievalEventId, sourceCaptureId };
}
