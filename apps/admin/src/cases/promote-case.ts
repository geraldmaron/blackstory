/**
 * Case -> canonical entity promotion (repo-k2kb). Replaces the untracked, gitignored
 * `.cache/promote-authority-net-2026-07-23.mjs` script — same transactional writes into
 * `bb_canonical.*`, `bb_evidence.*`, and `bb_research.case_history_events`, but committed,
 * tested, parameterized, and gated by `evaluateCasePromotionGate`
 * (`@repo/domain`, `packages/domain/src/promotion/case-promotion.ts`) instead of a hardcoded
 * actor id anyone with repo access could re-run unreviewed.
 *
 * Authority boundary: this module lives in apps/admin, not operator-cli, because promoting a
 * canonical entity requires an *approver* identity distinct from whoever proposed the record
 * admin already has that distinction via Supabase-role auth (see `auth/request-auth.ts`);
 * operator-cli deliberately does not (see `promotion-boundary.test.ts`).
 *
 * Deliberately does NOT write into `bb_research.cases.publication` the ad hoc script it
 * replaces did, but that column is typed (`ResearchCaseRecord['publication']`) for *public
 * release* metadata (`releaseId`/`publishedAt`/`revision`), a later, distinct stage. Reusing it
 * for "promoted to canonical" would silently corrupt that field for any later release step.
 * Instead the canonical link is recorded the same way the ad hoc script already did on the
 * entity side (`entities.identifiers: [{scheme: 'research_case', value: caseId}]`) and on the
 * case side via a `case_history_events` row (same state in/out, reason_code carries the fact).
 */
import { randomUUID, createHash } from 'node:crypto';
import type pg from 'pg';
import {
  evaluateCasePromotionGate,
  validateCanonicalPromotionRecord,
  type CanonicalPromotionRecord,
} from '@repo/domain';
import { withPostgresTransaction } from '@/lib/postgres-client';
import { getAdminResearchCaseDetail } from './research-case-store';

export type PromoteCaseInput = {
  readonly caseId: string;
  readonly record: CanonicalPromotionRecord;
  /** Identity of whoever assembled/proposed this record must differ from the approver. */
  readonly proposerId: string;
  readonly approverUid: string;
  readonly approverEmail: string;
  readonly reason: string;
};

export type PromoteCaseResult = {
  readonly entityId: string;
  readonly claimId: string;
  readonly locationId: string;
  readonly evidenceIds: readonly string[];
  readonly auditEventId: string;
};

export class CasePromotionRejected extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(`Case promotion rejected: ${reasons.join(', ')}`);
    this.name = 'CasePromotionRejected';
  }
}

function shortHash(value: string, length = 24): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function evidenceIdFor(url: string, excerpt: string): string {
  return `ev_canonical_promotion_${shortHash(`${url}\n${excerpt}`)}`;
}

async function ensureNoCatalogDuplicate(
  client: pg.PoolClient,
  record: CanonicalPromotionRecord,
): Promise<void> {
  const aliases = (record.aliases ?? []).map((alias) => alias.toLowerCase());
  const result = await client.query(
    `SELECT id, display_name
       FROM bb_canonical.entities
      WHERE id <> $1
        AND (
          lower(display_name) = lower($2)
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(aliases) alias
            WHERE lower(alias) = lower($2)
          )
          OR lower(display_name) = ANY($3::text[])
        )`,
    [record.entityId, record.displayName, aliases],
  );
  if ((result.rowCount ?? 0) > 0) {
    throw new Error(
      `Live catalog duplicate check failed for "${record.displayName}": ${JSON.stringify(result.rows)}`,
    );
  }
}

async function insertSourceAndEvidence(
  client: pg.PoolClient,
  source: CanonicalPromotionRecord['sources'][number],
  approverUid: string,
  nowIso: string,
): Promise<{ readonly evidenceId: string }> {
  const host = new URL(source.url).hostname.toLowerCase();
  const sourceId = `src_canonical_promotion_${shortHash(host, 20)}`;
  const itemId = `srcitem_canonical_promotion_${shortHash(source.url)}`;
  const evidenceId = evidenceIdFor(source.url, source.excerpt);

  await client.query(
    `INSERT INTO bb_evidence.evidence_sources (id, display_name, adapter_id, adapter_enabled, rights)
     VALUES ($1, $2, 'manual-review', false, $3::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [sourceId, host, JSON.stringify({ citationOnly: true, sourceType: 'web' })],
  );
  await client.query(
    `INSERT INTO bb_evidence.source_items (id, source_id, stable_identifier, title, url, metadata)
     VALUES ($1, $2, $3, $4, $3, $5::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [itemId, sourceId, source.url, source.title, JSON.stringify({ validatedAt: nowIso, validatedBy: approverUid })],
  );
  await client.query(
    `INSERT INTO bb_evidence.evidence_records (id, source_item_id, rights_status, excerpt, lineage_root_id, metadata)
     VALUES ($1, $2, $3, $4, $1, $5::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      evidenceId,
      itemId,
      host.endsWith('.gov') ? 'public_government_citation' : 'citation_only',
      source.excerpt,
      JSON.stringify({
        sourceLineage: host,
        fitness: source.fitness,
        manualReview: 'accepted',
        validatedAt: nowIso,
        validatedBy: approverUid,
        locationOnly: source.locationOnly === true,
      }),
    ],
  );
  return { evidenceId };
}

async function insertCanonicalRecord(
  client: pg.PoolClient,
  input: PromoteCaseInput,
  nowIso: string,
): Promise<PromoteCaseResult> {
  const { record, caseId, approverUid } = input;
  const evidence: { evidenceId: string; source: CanonicalPromotionRecord['sources'][number] }[] = [];
  for (const source of record.sources) {
    evidence.push({ ...(await insertSourceAndEvidence(client, source, approverUid, nowIso)), source });
  }
  const supportingEvidence = evidence.filter(({ source }) => !source.locationOnly);
  const allEvidenceIds = evidence.map((item) => item.evidenceId);
  const claimId = `claim_${record.entityId}_documented_site`;
  const claimVersionId = `clv_canonical_promotion_${shortHash(`${claimId}\n${record.summary}`)}`;
  const locationId = `loc_canonical_promotion_${shortHash(record.entityId)}`;

  const kindDetail = {
    editorial: { summary: record.summary, extendedNarrative: null, historicalContext: null },
    publication: { source: 'admin_case_promotion', publicRelease: false, promotedAt: nowIso },
    jurisdiction: { label: record.jurisdiction },
    classification: {
      keywords: record.topicTags,
      taxonomy: {},
      topicIds: record.topicIds,
      topicTags: record.topicTags,
      eraBuckets: record.eraBuckets,
      researchCoverage: 'substantial',
      mentionedEntityIds: [],
    },
    review: {
      validatedBy: approverUid,
      validatedAt: nowIso,
      independentLineageCount: supportingEvidence.length,
      exactCatalogDuplicateCheck: 'passed',
      publicReleaseActivated: false,
      locationAccessNote: record.location.accessNote ?? null,
    },
  };

  await client.query(
    `INSERT INTO bb_canonical.entities
      (id, kind, entity_class, display_name, aliases, identifiers, living_status,
       status_history, notability_basis, sensitivity, kind_detail)
     VALUES ($1, 'place', 'place', $2, $3::jsonb, $4::jsonb, 'not_applicable',
             '[]'::jsonb, $5::jsonb, '[]'::jsonb, $6::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      record.entityId,
      record.displayName,
      JSON.stringify(record.aliases ?? []),
      JSON.stringify([{ scheme: 'research_case', value: caseId }]),
      JSON.stringify([
        {
          criterion: 'documented_site',
          note: record.summary,
          evidenceIds: supportingEvidence.map((item) => item.evidenceId),
        },
      ]),
      JSON.stringify(kindDetail),
    ],
  );

  await client.query(
    `INSERT INTO bb_canonical.entity_locations
      (id, entity_id, role, geometry_type, geometry, location, lat, lng,
       geohash, geohash_prefixes, precision, match_method, label, evidence_ids, modern_zip)
     SELECT
       $1, $2, 'current', 'Point',
       jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array($3::float8, $4::float8)),
       ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326)::geography,
       $4::float8, $3::float8,
       ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5),
       ARRAY[
         substring(ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5) from 1 for 1),
         substring(ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5) from 1 for 2),
         substring(ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5) from 1 for 3),
         substring(ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5) from 1 for 4),
         ST_GeoHash(ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 5)
       ],
       $5, $6, $7, $8::text[], $9::jsonb
     ON CONFLICT (id) DO NOTHING`,
    [
      locationId,
      record.entityId,
      record.location.lng,
      record.location.lat,
      record.location.precision,
      record.location.matchMethod,
      record.location.label,
      allEvidenceIds,
      JSON.stringify({ zip: record.location.zip ?? null }),
    ],
  );

  await client.query(
    `INSERT INTO bb_canonical.claims
      (id, entity_id, claim_class, workflow_status, publication_status, procedural_status,
       confidence, research_coverage, verification)
     VALUES ($1, $2, 'standard', 'accepted', 'staged', 'reviewed', $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      claimId,
      record.entityId,
      JSON.stringify({
        level: 'high',
        source: 'manual_two_lineage_validation',
        independentLineageCount: supportingEvidence.length,
      }),
      JSON.stringify({ level: 'substantial', source: 'manual_review' }),
      JSON.stringify({
        status: 'manually_validated',
        citationReferencePresent: true,
        supportingExcerptPresent: true,
        sourceCapturePresent: false,
        independentLineageCount: supportingEvidence.length,
        validatedAt: nowIso,
        validatedBy: approverUid,
      }),
    ],
  );

  await client.query(
    `INSERT INTO bb_canonical.claim_versions
      (id, claim_id, predicate, object, workflow_status, publication_status, confidence, body, created_by)
     VALUES ($1, $2, 'documented_site', $3::jsonb, 'accepted', 'staged', $4::jsonb, $5::jsonb, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      claimVersionId,
      claimId,
      JSON.stringify(record.summary),
      JSON.stringify({
        level: 'high',
        source: 'manual_two_lineage_validation',
        independentLineageCount: supportingEvidence.length,
      }),
      JSON.stringify({
        citations: record.sources.map((source) => ({
          href: source.url,
          label: source.title,
          source: new URL(source.url).hostname,
          role: source.locationOnly ? 'contextual' : 'supporting',
        })),
        provenance: { method: 'admin_case_promotion', validatedAt: nowIso, validatedBy: approverUid },
        limitations: {
          sourceCapturePresent: false,
          supportingExcerptPresent: true,
          publicReleaseActivated: false,
        },
      }),
      approverUid,
    ],
  );

  await client.query(
    `UPDATE bb_canonical.claims SET current_version_id = $2, updated_at = now()
     WHERE id = $1 AND current_version_id IS NULL`,
    [claimId, claimVersionId],
  );

  for (const item of evidence) {
    const linkId = `cel_canonical_promotion_${shortHash(`${claimId}\n${item.evidenceId}`)}`;
    await client.query(
      `INSERT INTO bb_canonical.claim_evidence_links
        (id, claim_id, claim_version_id, evidence_id, role, lineage_root_id, quality, asserted_value)
       VALUES ($1, $2, $3, $4, $5, $4, $6::jsonb, $7::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        linkId,
        claimId,
        claimVersionId,
        item.evidenceId,
        item.source.locationOnly ? 'contextual' : 'supporting',
        JSON.stringify({
          captured: false,
          excerptAvailable: true,
          reviewedBy: approverUid,
          fitness: item.source.fitness,
        }),
        JSON.stringify(item.source.locationOnly ? record.location.label : record.summary),
      ],
    );
  }

  return {
    entityId: record.entityId,
    claimId,
    locationId,
    evidenceIds: allEvidenceIds,
    auditEventId: '', // filled in by the caller once the audit row is inserted
  };
}

async function recordCaseHistoryAndAudit(
  client: pg.PoolClient,
  input: PromoteCaseInput,
  caseState: string,
  result: PromoteCaseResult,
  nowIso: string,
): Promise<string> {
  await client.query(
    `INSERT INTO bb_research.case_history_events
      (case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids, occurred_at, metadata)
     VALUES ($1, $2, $2, 'canonical_promotion_approved', $3, $4, $5::text[], $6, $7::jsonb)`,
    [
      input.caseId,
      caseState,
      input.reason,
      input.approverUid,
      result.evidenceIds,
      nowIso,
      JSON.stringify({ proposerId: input.proposerId, targetEntityId: result.entityId }),
    ],
  );

  const auditId = randomUUID();
  await client.query(
    `INSERT INTO bb_audit.events
      (id, action, category, actor, subject, reason, request_id, correlation_id,
       entity_id, idempotency_key, occurred_at, data)
     VALUES ($1, 'research_case.promoted_to_canonical', 'research', $2::jsonb, $3::jsonb, $4, $5, $5,
             $6, $7, $8, $9::jsonb)`,
    [
      auditId,
      JSON.stringify({ id: input.approverUid, type: 'user', displayName: input.approverEmail }),
      JSON.stringify({ type: 'research_case', id: input.caseId }),
      input.reason,
      randomUUID(),
      result.entityId,
      `case-promotion:${input.caseId}:${result.entityId}`,
      nowIso,
      JSON.stringify({
        proposerId: input.proposerId,
        approverId: input.approverUid,
        caseId: input.caseId,
        entityId: result.entityId,
        claimId: result.claimId,
        evidenceIds: result.evidenceIds,
      }),
    ],
  );
  return auditId;
}

/**
 * Promotes one research case's proposed record into `bb_canonical.*`. Throws
 * `CasePromotionRejected` (gate/validation failure, no writes) or a plain `Error` (case not
 * found, live duplicate). All writes happen in one transaction.
 */
export async function promoteCaseToCanonical(input: PromoteCaseInput): Promise<PromoteCaseResult> {
  const detail = await getAdminResearchCaseDetail(input.caseId);
  if (!detail) throw new Error(`Research case not found: ${input.caseId}`);

  const gate = evaluateCasePromotionGate({
    caseState: detail.state,
    proposerId: input.proposerId,
    approverId: input.approverUid,
  });
  if (!gate.approved) throw new CasePromotionRejected(gate.reasons);

  const validation = validateCanonicalPromotionRecord(input.record);
  if (!validation.valid) throw new CasePromotionRejected(validation.reasons);

  const nowIso = new Date().toISOString();
  return withPostgresTransaction(async (client) => {
    await ensureNoCatalogDuplicate(client, input.record);
    const inserted = await insertCanonicalRecord(client, input, nowIso);
    const auditEventId = await recordCaseHistoryAndAudit(client, input, detail.state, inserted, nowIso);
    return { ...inserted, auditEventId };
  });
}
