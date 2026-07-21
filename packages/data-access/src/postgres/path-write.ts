/**
 * Maps Firestore-style document paths used by commitWithAudit onto bb_* Postgres upserts.
 * Unsupported roots throw with a clear path error (fail closed — no silent Firestore fallback).
 */
import type pg from 'pg';
import { randomUUID } from 'node:crypto';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toIso(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

function decodeIdempotencyDocId(docId: string): string {
  return Buffer.from(docId, 'base64url').toString('utf8');
}

async function upsertResearchCase(
  client: pg.PoolClient,
  caseId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO bb_research.cases
      (id, state, candidate_id, title, relevance_assessment, assignment, publication, retraction,
       created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       candidate_id = EXCLUDED.candidate_id,
       title = EXCLUDED.title,
       relevance_assessment = EXCLUDED.relevance_assessment,
       assignment = EXCLUDED.assignment,
       publication = EXCLUDED.publication,
       retraction = EXCLUDED.retraction,
       updated_at = EXCLUDED.updated_at`,
    [
      caseId,
      asString(data.state, 'candidate'),
      asString(data.candidateId, caseId),
      asString(data.title, caseId),
      data.relevanceAssessment ? JSON.stringify(data.relevanceAssessment) : null,
      data.assignment ? JSON.stringify(data.assignment) : null,
      data.publication ? JSON.stringify(data.publication) : null,
      data.retraction ? JSON.stringify(data.retraction) : null,
      toIso(data.createdAt, now),
      toIso(data.updatedAt, now),
    ],
  );

  await client.query(`DELETE FROM bb_research.case_history_events WHERE case_id = $1`, [caseId]);
  await client.query(`DELETE FROM bb_research.case_checklist_items WHERE case_id = $1`, [caseId]);

  const history = Array.isArray(data.history) ? data.history : [];
  for (const entry of history) {
    const event = asRecord(entry);
    const metadata: Record<string, unknown> = {};
    if (typeof event.mergedIntoCaseId === 'string') {
      metadata.mergedIntoCaseId = event.mergedIntoCaseId;
    }
    await client.query(
      `INSERT INTO bb_research.case_history_events
        (case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids, occurred_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        caseId,
        asString(event.from ?? event.fromState, 'candidate'),
        asString(event.to ?? event.toState, asString(data.state, 'candidate')),
        asString(event.reasonCode, 'unspecified'),
        typeof event.reason === 'string' ? event.reason : null,
        asString(event.actorId, 'unknown'),
        asStringArray(event.evidenceIds),
        toIso(event.occurredAt, now),
        JSON.stringify(metadata),
      ],
    );
  }

  const checklistRoot = asRecord(data.checklist);
  const items = Array.isArray(checklistRoot.items) ? checklistRoot.items : [];
  for (const item of items) {
    const row = asRecord(item);
    const key = asString(row.key);
    if (!key) continue;
    await client.query(
      `INSERT INTO bb_research.case_checklist_items
        (case_id, key, complete, evidence_ids, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (case_id, key) DO UPDATE SET
         complete = EXCLUDED.complete,
         evidence_ids = EXCLUDED.evidence_ids,
         note = EXCLUDED.note`,
      [
        caseId,
        key,
        row.complete === true,
        asStringArray(row.evidenceIds),
        typeof row.note === 'string' ? row.note : null,
      ],
    );
  }
}

function coerceCreatedByUuid(createdBy: unknown): string {
  const raw = asString(createdBy);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  // Operator stamps are not always UUIDs; keep a stable synthetic UUID namespace for NOT NULL column.
  return randomUUID();
}

async function upsertSubmission(
  client: pg.PoolClient,
  submissionId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = asRecord(data.payload);
  const enrichedPayload = {
    ...payload,
    ...(typeof data.createdBy === 'string' ? { _createdByStamp: data.createdBy } : {}),
  };
  await client.query(
    `INSERT INTO bb_submissions.intake_items
      (id, status, created_by, kind, payload, source_url, created_at)
     VALUES ($1,$2,$3::uuid,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       kind = EXCLUDED.kind,
       payload = EXCLUDED.payload,
       source_url = EXCLUDED.source_url`,
    [
      submissionId,
      asString(data.status, 'quarantined'),
      coerceCreatedByUuid(data.createdBy),
      typeof data.kind === 'string' ? data.kind : null,
      JSON.stringify(enrichedPayload),
      typeof data.sourceUrl === 'string' ? data.sourceUrl : null,
      toIso(data.createdAt, now),
    ],
  );
}

async function upsertCatalogDecision(
  client: pg.PoolClient,
  entityId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString();
  const decision = asString(data.action ?? data.decision, 'needs_review');
  await client.query(
    `INSERT INTO bb_ops.catalog_decisions
      (entity_id, decision, actor_id, reason, decided_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (entity_id) DO UPDATE SET
       decision = EXCLUDED.decision,
       actor_id = EXCLUDED.actor_id,
       reason = EXCLUDED.reason,
       decided_at = EXCLUDED.decided_at,
       metadata = EXCLUDED.metadata`,
    [
      entityId,
      decision,
      asString(data.decidedByUid ?? data.actorId, 'unknown'),
      typeof data.reason === 'string' ? data.reason : null,
      toIso(data.decidedAt, now),
      JSON.stringify({
        ...(typeof data.decidedByEmail === 'string' ? { decidedByEmail: data.decidedByEmail } : {}),
      }),
    ],
  );
}

async function upsertSourceOrganization(
  client: pg.PoolClient,
  organizationId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO bb_evidence.source_organizations
      (id, name, homepage, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       homepage = EXCLUDED.homepage,
       updated_at = EXCLUDED.updated_at`,
    [
      organizationId,
      asString(data.name, organizationId),
      typeof data.homepageUrl === 'string'
        ? data.homepageUrl
        : typeof data.homepage === 'string'
          ? data.homepage
          : null,
      toIso(data.createdAt, now),
      toIso(data.updatedAt, now),
    ],
  );
}

async function upsertEntityLocation(
  client: pg.PoolClient,
  entityId: string,
  locationId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString();
  const point = asRecord(data.point);
  const lat =
    typeof point.lat === 'number' ? point.lat : typeof data.lat === 'number' ? data.lat : null;
  const lng =
    typeof point.lng === 'number' ? point.lng : typeof data.lng === 'number' ? data.lng : null;
  const role = asString(data.role, 'approximate');
  await client.query(
    `INSERT INTO bb_canonical.entity_locations
      (id, entity_id, role, lat, lng, geohash, precision, match_method, label, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       entity_id = EXCLUDED.entity_id,
       role = EXCLUDED.role,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       geohash = EXCLUDED.geohash,
       precision = EXCLUDED.precision,
       match_method = EXCLUDED.match_method,
       label = EXCLUDED.label,
       updated_at = EXCLUDED.updated_at`,
    [
      locationId,
      entityId,
      role === 'historical' || role === 'current' || role === 'approximate' ? role : 'approximate',
      lat,
      lng,
      typeof point.geohash === 'string' ? point.geohash : null,
      typeof data.precision === 'string' ? data.precision : null,
      typeof asRecord(data.match).method === 'string'
        ? asString(asRecord(data.match).method)
        : typeof data.matchMethod === 'string'
          ? data.matchMethod
          : null,
      typeof data.label === 'string' ? data.label : null,
      toIso(data.createdAt ?? data.recordedAt, now),
      toIso(data.updatedAt ?? data.recordedAt, now),
    ],
  );
}

async function insertAuditEvent(
  client: pg.PoolClient,
  eventId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_audit.events
      (id, action, category, actor, subject, reason, request_id, correlation_id,
       release_id, entity_id, idempotency_key, occurred_at, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      eventId,
      asString(data.action),
      asString(data.category),
      JSON.stringify(data.actor ?? {}),
      JSON.stringify(data.subject ?? {}),
      asString(data.reason),
      asString(data.requestId),
      asString(data.correlationId),
      typeof data.releaseId === 'string' ? data.releaseId : null,
      typeof data.entityId === 'string' ? data.entityId : null,
      asString(data.idempotencyKey),
      toIso(data.occurredAt, new Date().toISOString()),
      JSON.stringify(data.data ?? {}),
    ],
  );
}

async function insertOutboxMessage(
  client: pg.PoolClient,
  messageId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_ops.outbox_messages
      (id, event_id, topic, aggregate_type, aggregate_id, payload, status, attempts,
       max_attempts, available_at, created_at, correlation_id, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      messageId,
      asString(data.eventId),
      asString(data.topic),
      asString(data.aggregateType),
      asString(data.aggregateId),
      JSON.stringify(data.payload ?? {}),
      asString(data.status, 'pending'),
      typeof data.attempts === 'number' ? data.attempts : 0,
      typeof data.maxAttempts === 'number' ? data.maxAttempts : 5,
      toIso(data.availableAt, new Date().toISOString()),
      toIso(data.createdAt, new Date().toISOString()),
      asString(data.correlationId),
      asString(data.idempotencyKey),
    ],
  );
}

async function insertIdempotencyKey(
  client: pg.PoolClient,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_ops.idempotency_keys
      (key, event_id, outbox_message_id, correlation_id, created_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (key) DO NOTHING`,
    [
      asString(data.key),
      asString(data.eventId),
      asString(data.outboxMessageId),
      asString(data.correlationId),
      toIso(data.createdAt, new Date().toISOString()),
    ],
  );
}

async function upsertKillSwitch(
  client: pg.PoolClient,
  switchId: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_ops.kill_switches (id, enabled, reason, updated_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       reason = EXCLUDED.reason,
       updated_at = EXCLUDED.updated_at`,
    [
      switchId,
      data.enabled === true,
      typeof data.reason === 'string' ? data.reason : null,
      toIso(data.updatedAt, new Date().toISOString()),
    ],
  );
}

export async function applyPostgresDocumentMutation(
  client: pg.PoolClient,
  path: string,
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  const segments = path.split('/');
  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new Error(`Unsupported postgres document path: ${path}`);
  }
  const [root, id, subcollection, subId] = segments;

  if (root === 'researchCases' && segments.length === 2) {
    await upsertResearchCase(client, id!, data);
    return;
  }
  if (root === 'submissionInbox' && segments.length === 2) {
    await upsertSubmission(client, id!, data);
    return;
  }
  if (root === 'catalogDecisions' && segments.length === 2) {
    await upsertCatalogDecision(client, id!, data);
    return;
  }
  if (root === 'sourceOrganizations' && segments.length === 2) {
    await upsertSourceOrganization(client, id!, data);
    return;
  }
  if (
    root === 'canonicalEntities' &&
    subcollection === 'locations' &&
    segments.length === 4 &&
    subId
  ) {
    await upsertEntityLocation(client, id!, subId, data);
    return;
  }
  if (root === 'auditEvents' && segments.length === 2) {
    await insertAuditEvent(client, id!, data);
    return;
  }
  if (root === 'outboxMessages' && segments.length === 2) {
    await insertOutboxMessage(client, id!, data);
    return;
  }
  if (root === 'idempotencyKeys' && segments.length === 2) {
    await insertIdempotencyKey(client, data);
    return;
  }
  if (root === 'killSwitches' && segments.length === 2) {
    await upsertKillSwitch(client, id!, data);
    return;
  }

  throw new Error(
    `Postgres AtomicStore does not support path ${path}. Supported roots: researchCases, submissionInbox, catalogDecisions, sourceOrganizations, canonicalEntities/*/locations/*, auditEvents, outboxMessages, idempotencyKeys, killSwitches`,
  );
}

export async function readPostgresDocument(
  client: pg.PoolClient,
  path: string,
): Promise<{ exists: boolean; data: () => unknown }> {
  const segments = path.split('/');
  if (segments.length !== 2) {
    return { exists: false, data: () => undefined };
  }
  const [root, id] = segments;
  if (root === 'idempotencyKeys' && id) {
    const key = decodeIdempotencyDocId(id);
    const result = await client.query<{
      key: string;
      event_id: string | null;
      outbox_message_id: string | null;
      correlation_id: string | null;
      created_at: Date | string;
    }>(
      `SELECT key, event_id, outbox_message_id, correlation_id, created_at
       FROM bb_ops.idempotency_keys
       WHERE key = $1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return { exists: false, data: () => undefined };
    return {
      exists: true,
      data: () => ({
        key: row.key,
        eventId: row.event_id,
        outboxMessageId: row.outbox_message_id,
        correlationId: row.correlation_id,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      }),
    };
  }
  if (root === 'killSwitches' && id) {
    const result = await client.query<{
      id: string;
      enabled: boolean;
      reason: string | null;
      updated_at: Date | string;
    }>(`SELECT id, enabled, reason, updated_at FROM bb_ops.kill_switches WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) return { exists: false, data: () => undefined };
    return {
      exists: true,
      data: () => ({
        id: row.id,
        enabled: row.enabled,
        ...(row.reason ? { reason: row.reason } : {}),
        updatedAt:
          row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      }),
    };
  }
  return { exists: false, data: () => undefined };
}

export { decodeIdempotencyDocId };
