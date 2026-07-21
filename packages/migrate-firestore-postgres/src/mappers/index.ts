/**
 * Mappers: Firestore documents → bb_* table row shapes (idempotent upserts by natural PKs).
 */
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  asStringOrUndefined,
  omitUndefined,
  toIsoTimestamp,
  toJsonValue,
} from '../util.js';

export type PolicyActiveRow = {
  readonly id: 'active';
  readonly policy_version: string;
  readonly activated_at: string;
};

export function mapPolicyActive(docId: string, data: Record<string, unknown>): PolicyActiveRow | null {
  if (docId !== 'active') return null;
  return {
    id: 'active',
    policy_version: asString(data.policyVersion, 'unknown'),
    activated_at: toIsoTimestamp(data.activatedAt),
  };
}

export type PolicyVersionRow = {
  readonly id: string;
  readonly policy_version: string;
  readonly checksum: string;
  readonly notes?: string;
  readonly created_at?: string;
};

export function mapPolicyVersion(docId: string, data: Record<string, unknown>): PolicyVersionRow {
  const notes = asStringOrUndefined(data.notes);
  const createdAt =
    data.createdAt !== undefined ? toIsoTimestamp(data.createdAt) : undefined;
  return {
    id: docId,
    policy_version: asString(data.policyVersion, docId),
    checksum: asString(data.checksum, 'unknown'),
    ...(notes !== undefined ? { notes } : {}),
    ...(createdAt !== undefined ? { created_at: createdAt } : {}),
  };
}

export type KillSwitchRow = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly updated_at: string;
};

export function mapKillSwitch(docId: string, data: Record<string, unknown>): KillSwitchRow {
  const reason = asStringOrUndefined(data.reason);
  return {
    id: asString(data.id, docId),
    enabled: asBoolean(data.enabled, false),
    ...(reason !== undefined ? { reason } : {}),
    updated_at: toIsoTimestamp(data.updatedAt, new Date().toISOString()),
  };
}

export type PublicationReleaseRow = {
  readonly id: string;
  readonly status: string;
  readonly search_index_version?: string;
  readonly signed_manifest: unknown;
  readonly notes?: string;
  readonly created_by?: string;
  readonly created_at: string;
  readonly activated_at?: string;
  readonly updated_at: string;
};

export function mapPublicationRelease(
  docId: string,
  data: Record<string, unknown>,
): PublicationReleaseRow {
  const now = new Date().toISOString();
  const searchIndexVersion = asStringOrUndefined(data.searchIndexVersion);
  const notes = asStringOrUndefined(data.notes);
  const createdBy = asStringOrUndefined(data.createdBy);
  const activatedAt =
    data.activatedAt !== undefined ? toIsoTimestamp(data.activatedAt) : undefined;
  return {
    id: asString(data.releaseId, docId),
    status: asString(data.status, 'draft'),
    ...(searchIndexVersion !== undefined ? { search_index_version: searchIndexVersion } : {}),
    signed_manifest: data.signedManifest ?? {},
    ...(notes !== undefined ? { notes } : {}),
    ...(createdBy !== undefined ? { created_by: createdBy } : {}),
    created_at: toIsoTimestamp(data.createdAt, now),
    ...(activatedAt !== undefined ? { activated_at: activatedAt } : {}),
    updated_at: toIsoTimestamp(data.updatedAt, toIsoTimestamp(data.createdAt, now)),
  };
}

export type ActiveReleaseRow = {
  readonly id: 'active';
  readonly release_id: string;
  readonly activated_at: string;
  readonly search_index_version?: string;
  readonly manifest_hash?: string;
};

export function mapActiveRelease(data: Record<string, unknown>): ActiveReleaseRow {
  const searchIndexVersion = asStringOrUndefined(data.searchIndexVersion);
  const manifestHash = asStringOrUndefined(data.manifestHash);
  return {
    id: 'active',
    release_id: asString(data.releaseId),
    activated_at: toIsoTimestamp(data.activatedAt),
    ...(searchIndexVersion !== undefined ? { search_index_version: searchIndexVersion } : {}),
    ...(manifestHash !== undefined ? { manifest_hash: manifestHash } : {}),
  };
}

export type MaterializedSnapshotRow = {
  readonly name: string;
  readonly payload: unknown;
  readonly updated_at: string;
};

export function mapMaterializedSnapshot(
  docId: string,
  data: Record<string, unknown>,
): MaterializedSnapshotRow | null {
  if (docId === 'activeRelease') return null;
  return {
    name: docId,
    payload: data,
    updated_at: toIsoTimestamp(data.generatedAt ?? data.updatedAt, new Date().toISOString()),
  };
}

export type EvidenceSourceRow = {
  readonly id: string;
  readonly organization_id?: string;
  readonly display_name: string;
  readonly adapter_id?: string;
  readonly adapter_enabled: boolean;
  readonly rights: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

export function mapEvidenceSource(docId: string, data: Record<string, unknown>): EvidenceSourceRow {
  const policy = asRecord(data.policy);
  const rights = policy.rights ?? data.rights ?? {};
  const now = new Date().toISOString();
  const organizationId = asStringOrUndefined(data.organizationId);
  const adapterId = asStringOrUndefined(data.adapterId);
  return {
    id: asString(data.id, docId),
    ...(organizationId !== undefined ? { organization_id: organizationId } : {}),
    display_name: asString(data.displayName, docId),
    ...(adapterId !== undefined ? { adapter_id: adapterId } : {}),
    adapter_enabled: asBoolean(data.adapterEnabled, false),
    rights,
    created_at: toIsoTimestamp(data.createdAt, now),
    updated_at: toIsoTimestamp(data.updatedAt, now),
  };
}

export type SourceItemRow = {
  readonly id: string;
  readonly source_id: string;
  readonly stable_identifier: string;
  readonly title?: string;
  readonly url?: string;
  readonly metadata: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

export function mapSourceItem(docId: string, data: Record<string, unknown>): SourceItemRow {
  const now = new Date().toISOString();
  const {
    id: _id,
    sourceId,
    stableIdentifier,
    title,
    canonicalUrl,
    url,
    createdAt,
    updatedAt,
    ...rest
  } = data;
  const titleValue = asStringOrUndefined(title);
  const urlValue = asStringOrUndefined(canonicalUrl ?? url);
  return {
    id: asString(_id, docId),
    source_id: asString(sourceId),
    stable_identifier: asString(stableIdentifier, asString(canonicalUrl, docId)),
    ...(titleValue !== undefined ? { title: titleValue } : {}),
    ...(urlValue !== undefined ? { url: urlValue } : {}),
    metadata: rest,
    created_at: toIsoTimestamp(createdAt, now),
    updated_at: toIsoTimestamp(updatedAt, now),
  };
}

export type SourceCaptureRow = {
  readonly id: string;
  readonly source_item_id?: string;
  readonly content_hash_algorithm: string;
  readonly content_hash_digest: string;
  readonly parser_version?: string;
  readonly snapshot_mode?: string;
  readonly storage_object?: unknown;
  readonly captured_at: string;
  readonly created_at: string;
};

export function mapSourceCapture(docId: string, data: Record<string, unknown>): SourceCaptureRow {
  const hash = asRecord(data.contentHash);
  const now = new Date().toISOString();
  const storageUri = asStringOrUndefined(data.snapshotStorageObject);
  const sourceItemId = asStringOrUndefined(data.sourceItemId);
  const parserVersion = asStringOrUndefined(data.parserVersion);
  const snapshotMode = asStringOrUndefined(data.snapshotMode);
  return {
    id: asString(data.id, docId),
    ...(sourceItemId !== undefined ? { source_item_id: sourceItemId } : {}),
    content_hash_algorithm: asString(hash.algorithm, 'sha256'),
    content_hash_digest: asString(hash.digest, asString(data.contentHashDigest, docId)),
    ...(parserVersion !== undefined ? { parser_version: parserVersion } : {}),
    ...(snapshotMode !== undefined ? { snapshot_mode: snapshotMode } : {}),
    ...(storageUri !== undefined ? { storage_object: { uri: storageUri } } : {}),
    captured_at: toIsoTimestamp(data.retrievedAt ?? data.capturedAt, now),
    created_at: toIsoTimestamp(data.createdAt, now),
  };
}

export type RetrievalEventRow = {
  readonly id: string;
  readonly source_id?: string;
  readonly adapter_id?: string;
  readonly status: string;
  readonly http_status?: number;
  readonly detail: unknown;
  readonly occurred_at: string;
};

export function mapRetrievalEvent(docId: string, data: Record<string, unknown>): RetrievalEventRow {
  const {
    id: _id,
    sourceId,
    adapterId,
    status,
    httpStatus,
    occurredAt,
    retrievedAt,
    createdAt,
    ...rest
  } = data;
  const sourceIdValue = asStringOrUndefined(sourceId);
  const adapterIdValue = asStringOrUndefined(adapterId);
  const httpStatusValue = asNumber(httpStatus);
  return {
    id: asString(_id, docId),
    ...(sourceIdValue !== undefined ? { source_id: sourceIdValue } : {}),
    ...(adapterIdValue !== undefined ? { adapter_id: adapterIdValue } : {}),
    status: asString(status, 'unknown'),
    ...(httpStatusValue !== undefined ? { http_status: httpStatusValue } : {}),
    detail: rest,
    occurred_at: toIsoTimestamp(occurredAt ?? retrievedAt ?? createdAt),
  };
}

export type ResearchCaseRow = {
  readonly id: string;
  readonly state: string;
  readonly candidate_id: string;
  readonly title: string;
  readonly relevance_assessment?: unknown;
  readonly assignment?: unknown;
  readonly publication?: unknown;
  readonly retraction?: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

export type CaseHistoryEventRow = {
  readonly case_id: string;
  readonly from_state: string;
  readonly to_state: string;
  readonly reason_code: string;
  readonly reason?: string;
  readonly actor_id: string;
  readonly evidence_ids: readonly string[];
  readonly occurred_at: string;
  readonly metadata: unknown;
};

export type CaseChecklistItemRow = {
  readonly case_id: string;
  readonly key: string;
  readonly complete: boolean;
  readonly evidence_ids: readonly string[];
  readonly note?: string;
};

export function mapResearchCase(docId: string, data: Record<string, unknown>): {
  readonly caseRow: ResearchCaseRow;
  readonly history: readonly CaseHistoryEventRow[];
  readonly checklist: readonly CaseChecklistItemRow[];
} {
  const now = new Date().toISOString();
  const caseId = asString(data.id, docId);
  const caseRow = omitUndefined({
    id: caseId,
    state: asString(data.state, 'candidate'),
    candidate_id: asString(data.candidateId, caseId),
    title: asString(data.title, caseId),
    relevance_assessment: data.relevanceAssessment,
    assignment: data.assignment,
    publication: data.publication,
    retraction: data.retraction,
    created_at: toIsoTimestamp(data.createdAt, now),
    updated_at: toIsoTimestamp(data.updatedAt, now),
  }) as ResearchCaseRow;

  const historyRaw = Array.isArray(data.history) ? data.history : [];
  const history: CaseHistoryEventRow[] = [];
  for (const entry of historyRaw) {
    const e = asRecord(entry);
    const from = asString(e.from ?? e.fromState, 'candidate');
    const to = asString(e.to ?? e.toState, asString(data.state, 'candidate'));
    history.push(
      omitUndefined({
        case_id: caseId,
        from_state: from,
        to_state: to,
        reason_code: asString(e.reasonCode, 'unspecified'),
        reason: asStringOrUndefined(e.reason),
        actor_id: asString(e.actorId, 'unknown'),
        evidence_ids: asStringArray(e.evidenceIds),
        occurred_at: toIsoTimestamp(e.occurredAt, now),
        metadata: omitUndefined({
          ...(typeof e.metadata === 'object' && e.metadata !== null ? asRecord(e.metadata) : {}),
        }),
      }) as CaseHistoryEventRow,
    );
  }

  const checklistRoot = asRecord(data.checklist);
  const itemsRaw = Array.isArray(checklistRoot.items) ? checklistRoot.items : [];
  const checklist: CaseChecklistItemRow[] = [];
  for (const item of itemsRaw) {
    const i = asRecord(item);
    const key = asString(i.key);
    if (!key) continue;
    checklist.push(
      omitUndefined({
        case_id: caseId,
        key,
        complete: asBoolean(i.complete, false),
        evidence_ids: asStringArray(i.evidenceIds),
        note: asStringOrUndefined(i.note),
      }) as CaseChecklistItemRow,
    );
  }

  return { caseRow, history, checklist };
}

export type ProvenanceStatRow = {
  readonly id: string;
  readonly payload: unknown;
  readonly source: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly content_hash: string;
  readonly created_at: string;
};

function provenanceFields(data: Record<string, unknown>, now: string) {
  return {
    source: asString(data.source, 'unknown'),
    source_url: asString(data.sourceUrl, 'https://unknown.invalid'),
    retrieved_at: toIsoTimestamp(data.retrievedAt, now),
    content_hash: asString(data.contentHash, 'unknown'),
    created_at: toIsoTimestamp(data.createdAt, now),
  };
}

export function mapCensusNationalDecade(
  docId: string,
  data: Record<string, unknown>,
): ProvenanceStatRow & { readonly decade: number } {
  const now = new Date().toISOString();
  const decade = asNumber(data.decade) ?? Number(docId);
  const {
    id: _id,
    decade: _d,
    source,
    sourceUrl,
    retrievedAt,
    contentHash,
    createdAt,
    updatedAt,
    ...payload
  } = data;
  return {
    id: asString(_id, docId),
    decade,
    payload,
    ...provenanceFields(data, now),
  };
}

export function mapCensusStateDecade(
  docId: string,
  data: Record<string, unknown>,
): ProvenanceStatRow & { readonly state_fips: string; readonly decade: number } {
  const now = new Date().toISOString();
  const decade = asNumber(data.decade) ?? 0;
  const stateFips = asString(data.stateFips ?? data.state_fips, docId.split('_')[0] ?? docId);
  const {
    id: _id,
    decade: _d,
    stateFips: _sf,
    state_fips: _sf2,
    source,
    sourceUrl,
    retrievedAt,
    contentHash,
    createdAt,
    updatedAt,
    ...payload
  } = data;
  return {
    id: asString(_id, docId),
    state_fips: stateFips,
    decade,
    payload,
    ...provenanceFields(data, now),
  };
}

export type SearchIndexRow = {
  readonly id: string;
  readonly release_id: string;
  readonly entity_id?: string;
  readonly name?: string;
  readonly name_lower?: string;
  readonly aliases: readonly string[];
  readonly topics: readonly string[];
  readonly kind?: string;
  readonly status?: string;
  readonly geohash?: string;
  readonly related_count?: number;
  readonly claim_count?: number;
  readonly facets: unknown;
  readonly created_at: string;
};

export function mapSearchIndex(
  docId: string,
  data: Record<string, unknown>,
  defaultReleaseId: string,
): SearchIndexRow {
  const now = new Date().toISOString();
  return omitUndefined({
    id: asString(data.id, docId),
    release_id: asString(data.releaseId, defaultReleaseId),
    entity_id: asStringOrUndefined(data.entityId),
    name: asStringOrUndefined(data.name),
    name_lower: asStringOrUndefined(data.nameLower ?? (typeof data.name === 'string' ? data.name.toLowerCase() : undefined)),
    aliases: asStringArray(data.aliases),
    topics: asStringArray(data.topics),
    kind: asStringOrUndefined(data.kind),
    status: asStringOrUndefined(data.status),
    geohash: asStringOrUndefined(data.geohash),
    related_count: asNumber(data.relatedCount),
    claim_count: asNumber(data.claimCount),
    facets: data.facets ?? {},
    created_at: toIsoTimestamp(data.createdAt, now),
  }) as SearchIndexRow;
}

export type ReleaseEntityRow = {
  readonly release_id: string;
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary?: string;
  readonly location?: unknown;
  readonly geohash?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly claims: unknown;
  readonly taxonomy: unknown;
  readonly related: unknown;
  readonly primary_image?: unknown;
  readonly projection: unknown;
  readonly created_at: string;
};

export function mapReleaseEntity(
  releaseId: string,
  docId: string,
  data: Record<string, unknown>,
): ReleaseEntityRow {
  const now = new Date().toISOString();
  const location = data.location;
  const loc = asRecord(location);
  return omitUndefined({
    release_id: releaseId,
    entity_id: asString(data.entityId ?? data.id, docId),
    display_name: asString(data.displayName ?? data.name, docId),
    kind: asString(data.kind, 'unknown'),
    summary: asStringOrUndefined(data.summary),
    location: location !== undefined ? toJsonValue(location) : undefined,
    geohash: asStringOrUndefined(data.geohash ?? loc.geohash),
    lat: asNumber(data.lat ?? loc.lat),
    lng: asNumber(data.lng ?? loc.lng),
    claims: toJsonValue(data.claims ?? []),
    taxonomy: toJsonValue(data.taxonomy ?? {}),
    related: toJsonValue(data.related ?? []),
    primary_image: data.primaryImage !== undefined ? toJsonValue(data.primaryImage) : undefined,
    projection: toJsonValue(data),
    created_at: toIsoTimestamp(data.createdAt, now),
  }) as ReleaseEntityRow;
}

export type ReleaseStoryRow = {
  readonly release_id: string;
  readonly slug: string;
  readonly title: string;
  readonly body: unknown;
  readonly sources: unknown;
  readonly related_entity_ids: readonly string[];
  readonly projection: unknown;
  readonly created_at: string;
};

export function mapReleaseStory(
  releaseId: string,
  docId: string,
  data: Record<string, unknown>,
): ReleaseStoryRow {
  const now = new Date().toISOString();
  return omitUndefined({
    release_id: releaseId,
    slug: asString(data.slug, docId),
    title: asString(data.title, docId),
    body: toJsonValue(data.body ?? {}),
    sources: toJsonValue(data.sources ?? []),
    related_entity_ids: asStringArray(data.relatedEntityIds),
    projection: toJsonValue(data),
    created_at: toIsoTimestamp(data.createdAt, now),
  }) as ReleaseStoryRow;
}

export type AuditEventRow = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly actor: unknown;
  readonly subject: unknown;
  readonly reason: string;
  readonly request_id: string;
  readonly correlation_id: string;
  readonly release_id?: string;
  readonly entity_id?: string;
  readonly idempotency_key: string;
  readonly occurred_at: string;
  readonly data: unknown;
};

export function mapAuditEvent(docId: string, data: Record<string, unknown>): AuditEventRow {
  return omitUndefined({
    id: asString(data.id, docId),
    action: asString(data.action, 'unknown'),
    category: asString(data.category, 'ops'),
    actor: data.actor ?? {},
    subject: data.subject ?? {},
    reason: asString(data.reason, ''),
    request_id: asString(data.requestId, docId),
    correlation_id: asString(data.correlationId, docId),
    release_id: asStringOrUndefined(data.releaseId),
    entity_id: asStringOrUndefined(data.entityId),
    idempotency_key: asString(data.idempotencyKey, docId),
    occurred_at: toIsoTimestamp(data.occurredAt ?? data.createdAt),
    data: data.data ?? {},
  }) as AuditEventRow;
}

export type OutboxMessageRow = {
  readonly id: string;
  readonly event_id: string;
  readonly topic: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly payload: unknown;
  readonly status: string;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly available_at: string;
  readonly created_at: string;
  readonly processed_at?: string;
  readonly last_error?: string;
  readonly correlation_id: string;
  readonly idempotency_key: string;
};

export function mapOutboxMessage(docId: string, data: Record<string, unknown>): OutboxMessageRow {
  const now = new Date().toISOString();
  return omitUndefined({
    id: asString(data.id, docId),
    event_id: asString(data.eventId, docId),
    topic: asString(data.topic, 'unknown'),
    aggregate_type: asString(data.aggregateType, 'unknown'),
    aggregate_id: asString(data.aggregateId, 'unknown'),
    payload: data.payload ?? {},
    status: asString(data.status, 'pending'),
    attempts: asNumber(data.attempts) ?? 0,
    max_attempts: asNumber(data.maxAttempts) ?? 5,
    available_at: toIsoTimestamp(data.availableAt, now),
    created_at: toIsoTimestamp(data.createdAt, now),
    processed_at: data.processedAt !== undefined ? toIsoTimestamp(data.processedAt) : undefined,
    last_error: asStringOrUndefined(data.lastError),
    correlation_id: asString(data.correlationId, docId),
    idempotency_key: asString(data.idempotencyKey, docId),
  }) as OutboxMessageRow;
}

export type IdempotencyKeyRow = {
  readonly key: string;
  readonly event_id?: string;
  readonly outbox_message_id?: string;
  readonly correlation_id?: string;
  readonly created_at: string;
};

export function mapIdempotencyKey(docId: string, data: Record<string, unknown>): IdempotencyKeyRow {
  return omitUndefined({
    key: asString(data.key, docId),
    event_id: asStringOrUndefined(data.eventId),
    outbox_message_id: asStringOrUndefined(data.outboxMessageId),
    correlation_id: asStringOrUndefined(data.correlationId),
    created_at: toIsoTimestamp(data.createdAt),
  }) as IdempotencyKeyRow;
}

export type SubmissionRow = {
  readonly id: string;
  readonly status: string;
  readonly created_by: string;
  readonly kind?: string;
  readonly payload: unknown;
  readonly source_url?: string;
  readonly created_at: string;
};

export function mapSubmission(docId: string, data: Record<string, unknown>): SubmissionRow {
  return omitUndefined({
    id: docId,
    status: asString(data.status, 'quarantined'),
    created_by: asString(data.createdBy, '00000000-0000-0000-0000-000000000000'),
    kind: asStringOrUndefined(data.kind),
    payload: data.payload ?? {},
    source_url: asStringOrUndefined(data.sourceUrl),
    created_at: toIsoTimestamp(data.createdAt),
  }) as SubmissionRow;
}

export type StoryPacketReviewRow = {
  readonly id: string;
  readonly submission_id: string;
  readonly decision?: string;
  readonly reviewer_id?: string;
  readonly notes?: string;
  readonly packet: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

export function mapStoryPacketReview(
  docId: string,
  data: Record<string, unknown>,
): StoryPacketReviewRow {
  const now = new Date().toISOString();
  return omitUndefined({
    id: asString(data.id, docId),
    submission_id: asString(data.submissionId, docId),
    decision: asStringOrUndefined(data.decision),
    reviewer_id: asStringOrUndefined(data.reviewerId),
    notes: asStringOrUndefined(data.notes),
    packet: data.packet ?? data,
    created_at: toIsoTimestamp(data.createdAt, now),
    updated_at: toIsoTimestamp(data.updatedAt, now),
  }) as StoryPacketReviewRow;
}
