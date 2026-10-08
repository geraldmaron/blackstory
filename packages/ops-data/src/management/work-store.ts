/** Durable work orchestration. Research and release engines remain responsible for execution. */
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { assertContract } from '@repo/research-kernel';
import { validateCanonicalPromotionRecord, type CanonicalPromotionRecord } from '@repo/domain';
import { managementEntitySnapshot } from './catalog.js';
import { stableJson } from '../postgres/canonical-convergence.js';
import {
  workRequestSchema,
  workDecisionSchema,
  type WorkItem,
  type WorkProposal,
  type WorkState,
} from './contracts.js';

export class WorkConflict extends Error {}
export type WorkActor = {
  ownerId: string;
  canPublish: boolean;
  canResearch?: boolean;
  clientId?: string;
};
export const workDigest = (value: unknown): string =>
  createHash('sha256').update(stableJson(value)).digest('hex');

type Row = {
  id: string;
  owner_id: string;
  request: WorkItem['request'];
  state: WorkState;
  version: number;
  proposal: WorkProposal | null;
  proposal_hash: string | null;
  approved_entity_ids: string[];
  outcome: Record<string, unknown> | null;
  error: string | null;
  dispatch_status: WorkItem['dispatchStatus'];
  created_at: Date;
  updated_at: Date;
  lease_until: Date | null;
  retention_current?: boolean;
};
function item(row: Row): WorkItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    request: row.request,
    state: row.state,
    version: row.version,
    proposal: row.retention_current === false ? null : row.proposal,
    proposalHash: row.proposal_hash,
    approvedEntityIds: row.approved_entity_ids,
    outcome: row.outcome,
    error:
      row.retention_current === false
        ? 'The supporting research expired. Request fresh research before publication.'
        : row.error,
    dispatchStatus: row.dispatch_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    leaseExpiresAt: row.lease_until?.toISOString() ?? null,
  };
}
export function validateWorkProposal(value: unknown): WorkProposal {
  const proposal = assertContract('ManagementProposal', value);
  const ids = new Set<string>();
  for (const change of proposal.changes) {
    if (ids.has(change.entityId)) throw new WorkConflict('Duplicate entity in proposal');
    ids.add(change.entityId);
    const validation = validateCanonicalPromotionRecord(change.record as CanonicalPromotionRecord);
    if (!validation.valid) throw new WorkConflict(`Invalid record: ${change.entityId}`);
    if (change.record.entityId !== change.entityId)
      throw new WorkConflict('Record identity differs');
    if ((change.operation === 'create') !== (change.beforeHash === null))
      throw new WorkConflict('Updates require the existing record revision');
    if (
      change.reviewBasis === 'independent_review' &&
      change.reviewerActorId === change.producerActorId
    )
      throw new WorkConflict('Self-review cannot be labeled independent');
    if (change.operation === 'update' && !/^[a-f0-9]{64}$/u.test(String(change.beforeHash)))
      throw new WorkConflict('Updates require a valid record digest');
    for (const source of change.record.sources) {
      if (
        !change.assertions.some((assertion) =>
          assertion.evidence.some(
            (evidence) => evidence.sourceUrl === source.url && evidence.quote === source.excerpt,
          ),
        )
      )
        throw new WorkConflict('Record citations must match reviewed evidence exactly');
    }
    const assertions = new Map(change.assertions.map((claim) => [claim.id, claim]));
    if (assertions.size !== change.assertions.length)
      throw new WorkConflict('Duplicate assertion identity');
    for (const assertion of change.assertions) {
      if (['supported', 'qualified'].includes(assertion.finding) && !assertion.evidence.length)
        throw new WorkConflict('Supported assertions require evidence');
    }
    const revisionIds = change.claimRevisions?.map((r) => r.claimId) ?? [];
    if (new Set(revisionIds).size !== revisionIds.length)
      throw new WorkConflict('Duplicate claim revision');
    for (const id of [
      ...(change.locationRevision?.assertionIds ?? []),
      ...(change.claimRevisions?.flatMap((r) => r.replacementAssertionIds) ?? []),
    ]) {
      const assertion = assertions.get(id);
      if (!assertion || !['supported', 'qualified'].includes(assertion.finding))
        throw new WorkConflict('Revision depends on unresolved evidence');
    }
    for (const sentence of [
      ...change.sentenceClaims,
      ...(change.contextRevision?.sentenceClaims ?? []),
    ]) {
      if (!sentence.assertionIds.length)
        throw new WorkConflict('Public sentences require assertions');
      for (const id of sentence.assertionIds) {
        const assertion = assertions.get(id);
        if (!assertion || !['supported', 'qualified'].includes(assertion.finding))
          throw new WorkConflict('Public prose depends on unresolved evidence');
      }
    }
    const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
    if (
      change.contextRevision &&
      normalize(change.contextRevision.sentenceClaims.map((row) => row.sentence).join(' ')) !==
        normalize(change.contextRevision.text)
    )
      throw new WorkConflict('Every public context sentence must be reviewed exactly');
    if (
      normalize(change.sentenceClaims.map((row) => row.sentence).join(' ')) !==
      normalize(String(change.record.summary))
    )
      throw new WorkConflict('Every public summary sentence must be reviewed exactly');
  }
  return proposal;
}

export class ManagementWorkStore {
  constructor(readonly pool: Pool) {}
  async transaction<T>(operation: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const result = await operation(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  async submit(actor: WorkActor, value: unknown): Promise<WorkItem> {
    if (!actor.canResearch) throw new WorkConflict('Research permission required');
    const request = workRequestSchema.parse(value);
    return this.transaction(async (db) => {
      await db.query(
        `INSERT INTO research.management_work(owner_id,idempotency_key,request)
        VALUES ($1,$2,$3::jsonb) ON CONFLICT(owner_id,idempotency_key) DO NOTHING`,
        [actor.ownerId, request.idempotencyKey, JSON.stringify(request)],
      );
      const result = await db.query<Row>(
        `SELECT * FROM research.management_work
        WHERE owner_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [actor.ownerId, request.idempotencyKey],
      );
      const existing = result.rows[0]!;
      if (workDigest(existing.request) !== workDigest(request))
        throw new WorkConflict('Request key already used for different content');
      return item(existing);
    });
  }
  async get(actor: WorkActor, id: string): Promise<WorkItem | null> {
    const result = await this.pool.query<Row>(
      `SELECT w.*, CASE WHEN w.proposal IS NULL THEN true ELSE research.management_proposal_retention_current(w.proposal,p.created_at) END AS retention_current
       FROM research.management_work w LEFT JOIN research.management_work_proposals p ON p.work_id=w.id AND p.version=w.version WHERE w.id=$1 AND w.owner_id=$2`,
      [id, actor.ownerId],
    );
    return result.rows[0] ? item(result.rows[0]) : null;
  }
  async list(actor: WorkActor): Promise<WorkItem[]> {
    const result = await this.pool.query<Row>(
      `SELECT w.*, CASE WHEN w.proposal IS NULL THEN true ELSE research.management_proposal_retention_current(w.proposal,p.created_at) END AS retention_current
       FROM research.management_work w LEFT JOIN research.management_work_proposals p ON p.work_id=w.id AND p.version=w.version WHERE w.owner_id=$1 ORDER BY w.updated_at DESC LIMIT 50`,
      [actor.ownerId],
    );
    return result.rows.map(item);
  }
  async saveProposal(id: string, lease: string, value: unknown): Promise<void> {
    let proposal = validateWorkProposal(value);
    await this.transaction(async (db) => {
      const result = await db.query<Row>(
        `SELECT * FROM research.management_work
        WHERE id=$1 AND lease_token=$2 AND lease_until>now() AND state='researching' FOR UPDATE`,
        [id, lease],
      );
      const current = result.rows[0];
      if (!current) throw new WorkConflict('Research lease is no longer current');
      // A revision may touch only changes whose approval was withdrawn by the owner.
      // Keep the exact reviewed bytes, including the trusted before view, for all others.
      const fixedIds = new Set([
        ...current.approved_entity_ids,
        ...(Array.isArray(current.outcome?.publishedEntityIds)
          ? (current.outcome.publishedEntityIds as string[])
          : []),
      ]);
      const changes = [];
      for (const change of proposal.changes.filter((change) => !fixedIds.has(change.entityId))) {
        const snapshot = await managementEntitySnapshot(db, change.entityId);
        if (change.operation === 'create' && snapshot)
          throw new WorkConflict('A proposed new record already exists');
        if (
          change.operation === 'update' &&
          (!snapshot || workDigest(snapshot) !== change.beforeHash)
        )
          throw new WorkConflict('Record changed during research');
        if (
          change.operation === 'create' &&
          (change.claimRevisions?.length || change.locationRevision)
        )
          throw new WorkConflict('New records cannot revise existing claims or locations');
        if (
          change.claimRevisions?.some(
            (revision) =>
              !snapshot?.claims.some(
                (row: { claim: { id: string } }) => row.claim.id === revision.claimId,
              ),
          )
        )
          throw new WorkConflict('Revised claim does not belong to this record');
        if (
          change.locationRevision?.locationId &&
          !snapshot?.locations.some(
            (row: { id: string }) => row.id === change.locationRevision!.locationId,
          )
        )
          throw new WorkConflict('Revised location does not belong to this record');
        const before = snapshot
          ? {
              displayName: String(snapshot.entity.display_name),
              summary: String(snapshot.entity.kind_detail?.editorial?.summary ?? ''),
              historicalContext: String(
                snapshot.entity.kind_detail?.editorial?.historicalContext ?? '',
              ),
              claims: snapshot.claims.map(
                (row: { claim: { id: string }; version: { object?: unknown } | null }) => ({
                  id: row.claim.id,
                  statement:
                    typeof row.version?.object === 'string'
                      ? row.version.object
                      : JSON.stringify(row.version?.object ?? ''),
                }),
              ),
              locations: snapshot.locations.map(
                (row: {
                  id: string;
                  label?: string;
                  lat: number | null;
                  lng: number | null;
                  precision?: string;
                }) => ({
                  id: row.id,
                  label: row.label ?? '',
                  lat: row.lat,
                  lng: row.lng,
                  precision: row.precision ?? 'unknown',
                }),
              ),
            }
          : null;
        changes.push({ ...change, before });
      }
      for (const entityId of fixedIds) {
        const fixed = current.proposal?.changes.find((change) => change.entityId === entityId);
        if (
          !fixed &&
          Array.isArray(current.outcome?.publishedEntityIds) &&
          current.outcome.publishedEntityIds.includes(entityId)
        )
          continue;
        if (!fixed) throw new WorkConflict('Previously approved change is missing');
        changes.push(fixed);
      }
      proposal = { ...proposal, changes };
      const retention = await db.query(
        'SELECT research.management_proposal_retention_current($1::jsonb,now()) AS current',
        [JSON.stringify(proposal)],
      );
      if (!retention.rows[0]?.current)
        throw new WorkConflict('Supporting research expired or is unavailable');
      const hash = workDigest(proposal);
      const version = current.version + 1;
      await db.query(
        `INSERT INTO research.management_work_proposals(work_id,version,proposal_hash,proposal)
        VALUES($1,$2,$3,$4::jsonb)`,
        [id, version, hash, JSON.stringify(proposal)],
      );
      const retained = current.approved_entity_ids.filter((entityId) => {
        const before = current.proposal?.changes.find((change) => change.entityId === entityId);
        const after = proposal.changes.find((change) => change.entityId === entityId);
        return before && after && workDigest(before) === workDigest(after);
      });
      await db.query(
        `UPDATE research.management_work SET version=$2,proposal_hash=$3,proposal=$4::jsonb,
        state='awaiting_review',approved_entity_ids=$5,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now()
        WHERE id=$1`,
        [id, version, hash, JSON.stringify(proposal), retained],
      );
    });
  }
  async decide(actor: WorkActor, id: string, value: unknown): Promise<WorkItem> {
    const decision = workDecisionSchema.parse(value);
    if (decision.action !== 'approve' && !actor.canPublish && !actor.canResearch)
      throw new WorkConflict('Research permission required');
    if (decision.action === 'approve' && !actor.canPublish)
      throw new WorkConflict('Publication permission required');
    return this.transaction(async (db) => {
      const result = await db.query<Row>(
        'SELECT * FROM research.management_work WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, actor.ownerId],
      );
      const current = result.rows[0];
      if (!current) throw new WorkConflict('Work not found');
      if (actor.clientId) {
        const delegation = await db.query(
          `SELECT id FROM research.management_delegations
          WHERE id=$1 AND owner_id=$2 AND client_id=$3 AND session_id=$4 AND revoked_at IS NULL AND expires_at>now() FOR SHARE`,
          [decision.delegationId ?? null, actor.ownerId, actor.clientId, decision.sessionId],
        );
        if (!delegation.rows.length)
          throw new WorkConflict('An active session delegation is required');
      }
      const prior = await db.query(
        `SELECT * FROM research.management_work_decisions WHERE owner_id=$1 AND idempotency_key=$2`,
        [actor.ownerId, decision.idempotencyKey],
      );
      if (prior.rows[0]) {
        const row = prior.rows[0];
        if (
          row.work_id !== id ||
          row.version !== decision.version ||
          row.delegation_id !== (actor.clientId ? decision.delegationId : null) ||
          row.basis !== (actor.clientId ? 'agent_relay' : 'direct_owner') ||
          row.proposal_hash !== decision.proposalHash ||
          row.action !== decision.action ||
          stableJson(row.entity_ids) !== stableJson(decision.entityIds) ||
          row.reason !== decision.reason ||
          row.session_id !== decision.sessionId
        )
          throw new WorkConflict('Decision key already used for different content');
        return item(current);
      }
      if (current.version !== decision.version || current.proposal_hash !== decision.proposalHash)
        throw new WorkConflict('Proposal changed; review the current changes');
      if (!['awaiting_review', 'held', 'approved'].includes(current.state))
        throw new WorkConflict('Work is not awaiting a decision');
      if (decision.action === 'approve') {
        const retention = await db.query(
          `SELECT research.management_proposal_retention_current(proposal,created_at) AS current FROM research.management_work_proposals WHERE work_id=$1 AND version=$2`,
          [id, current.version],
        );
        if (!retention.rows[0]?.current)
          throw new WorkConflict('Supporting research expired; request fresh research');
      }
      const proposal = validateWorkProposal(current.proposal);
      if (!decision.entityIds.length && (decision.action === 'approve' || proposal.changes.length))
        throw new WorkConflict('Select at least one change');
      const publishedIds = Array.isArray(current.outcome?.publishedEntityIds)
        ? current.outcome.publishedEntityIds
        : [];
      if (decision.entityIds.some((id) => publishedIds.includes(id)))
        throw new WorkConflict('This change is already published');
      if (new Set(decision.entityIds).size !== decision.entityIds.length)
        throw new WorkConflict('Duplicate selection');
      for (const entityId of decision.entityIds) {
        const change = proposal.changes.find((change) => change.entityId === entityId);
        if (!change || (decision.action === 'approve' && change.blockers.length))
          throw new WorkConflict('Selection is missing or blocked');
      }
      await db.query(
        `INSERT INTO research.management_work_decisions
        (work_id,owner_id,version,proposal_hash,entity_ids,action,basis,delegation_id,session_id,reason,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id,
          actor.ownerId,
          decision.version,
          decision.proposalHash,
          decision.entityIds,
          decision.action,
          actor.clientId ? 'agent_relay' : 'direct_owner',
          actor.clientId ? decision.delegationId : null,
          decision.sessionId,
          decision.reason,
          decision.idempotencyKey,
        ],
      );
      const approved =
        decision.action === 'approve'
          ? [
              ...new Set([
                ...current.approved_entity_ids.filter((id) => !publishedIds.includes(id)),
                ...decision.entityIds,
              ]),
            ]
          : current.approved_entity_ids.filter(
              (entityId) =>
                !decision.entityIds.includes(entityId) && !publishedIds.includes(entityId),
            );
      const next: WorkState =
        decision.action === 'request_changes'
          ? 'queued'
          : approved.length
            ? 'approved'
            : decision.action === 'hold'
              ? 'held'
              : 'awaiting_review';
      const updated = await db.query<Row>(
        `UPDATE research.management_work SET state=$2,approved_entity_ids=$3,
        error=NULL,dispatch_status='pending',updated_at=now() WHERE id=$1 RETURNING *`,
        [id, next, approved],
      );
      return item(updated.rows[0]!);
    });
  }
  async retry(actor: WorkActor, id: string): Promise<void> {
    if (!actor.canResearch && !actor.canPublish)
      throw new WorkConflict('Research permission required');
    // Disposal is authority-limited to expired payloads; it never edits valid proposal bytes.
    await this.pool.query('SELECT research.dispose_expired_management_proposals(true)');
    await this.transaction(async (db) => {
      const result = await db.query<Row>(
        'SELECT * FROM research.management_work WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, actor.ownerId],
      );
      const work = result.rows[0];
      if (!work) throw new WorkConflict('Work not found');
      if (work.approved_entity_ids.length && !actor.canPublish)
        throw new WorkConflict('Publication permission required');
      if (!work.approved_entity_ids.length && !actor.canResearch)
        throw new WorkConflict('Research permission required');
      const updated = await db.query(
        `UPDATE research.management_work SET
        state=CASE WHEN state='held' AND proposal IS NULL THEN 'queued' WHEN state='failed' THEN CASE WHEN cardinality(approved_entity_ids)>0 THEN 'approved' ELSE 'queued' END ELSE state END,
        dispatch_status='pending',dispatch_token=NULL,error=NULL
        WHERE id=$1 AND (state IN ('failed','queued','researching','approved','publishing','verification_failed') OR (state='held' AND proposal IS NULL))
          AND (lease_until IS NULL OR lease_until<now()) AND (dispatched_at IS NULL OR dispatched_at<now()-interval '2 minutes') RETURNING id`,
        [id],
      );
      if (!updated.rows.length) throw new WorkConflict('Work is running or cannot be retried');
    });
  }
  async claim(
    id: string,
    phase: 'research' | 'publish',
  ): Promise<{ work: WorkItem; lease: string } | null> {
    const lease = randomUUID();
    const result = await this.pool.query<Row>(
      `UPDATE research.management_work
      SET state=CASE WHEN $3='publish' THEN 'publishing' ELSE 'researching' END,
          lease_token=$2,lease_until=now()+interval '5 minutes',error=NULL,updated_at=now()
      WHERE id=$1 AND state IN ('queued','researching','approved','publishing','verification_failed','awaiting_review')
        AND (lease_until IS NULL OR lease_until<now())
        AND CASE WHEN $3='publish' THEN
          state IN ('approved','publishing','verification_failed') OR
          (state='awaiting_review' AND EXISTS(SELECT 1 FROM unnest(approved_entity_ids) AS approved(id)
            WHERE NOT COALESCE(outcome->'publishedEntityIds','[]'::jsonb) ? approved.id))
          ELSE state IN ('queued','researching') END
      RETURNING *`,
      [id, lease, phase],
    );
    return result.rows[0] ? { work: item(result.rows[0]), lease } : null;
  }
  async renew(id: string, lease: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE research.management_work SET lease_until=now()+interval '5 minutes'
      WHERE id=$1 AND lease_token=$2 AND lease_until>now() RETURNING id`,
      [id, lease],
    );
    if (!result.rows.length) throw new WorkConflict('Work lease expired');
  }
  async fail(id: string, lease: string, message: string, verification = false): Promise<void> {
    await this.pool.query(
      `UPDATE research.management_work SET state=$3,error=$4,lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2`,
      [id, lease, verification ? 'verification_failed' : 'failed', message],
    );
  }
}
