/**
 * Maps a published entity projection onto the deterministic content-expectations evaluator
 * (`@repo/domain` `evaluateContentExpectations`, spec v2) and summarizes the verdicts across a
 * corpus. This is the triage pass: it answers "which released records already meet the bar and
 * can be left alone, and which ones need work and specifically what kind", so enrichment targets
 * a measured deficiency instead of a lane guess.
 *
 * No model calls and no network — the evaluator is deterministic, so this is cheap to run and
 * cheap to re-run whenever the spec version or a record's content changes.
 *
 * On source counting: a "distinct source" here is a distinct PUBLISHER (citation host), not a
 * distinct document. Two NPS documents about the same property — the registry index entry and
 * its nomination form — are one publisher and count once, because the check exists to measure
 * corroboration, and a second document from the same agency does not corroborate the first.
 *
 * This is deliberately a different granularity from the publish depth gate in
 * `./incremental-publish.ts`, which compares documents. That gate asks "has anyone done any
 * research beyond the index row?", where a nomination form is a real answer. This check asks
 * "do independent publishers agree?", where it is not. Same corpus, two different questions.
 */
import {
  evaluateContentExpectations,
  isEntityKind,
  type ContentAuditResult,
  type EntityKind,
  type ResearchCoverageTier,
} from '@repo/domain';

/** The subset of a public entity projection this audit reads. */
export type AuditableProjection = {
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly historicalContext?: unknown;
  readonly extendedNarrative?: unknown;
  readonly impactStatement?: unknown;
  readonly researchCoverage?: unknown;
  readonly claims?: unknown;
  readonly related?: unknown;
};

/** Triage verdict recorded per entity. */
export type TriageVerdict = 'meets_bar' | 'needs_work';

export type EntityContentAudit = {
  readonly entityId: string;
  readonly kind: EntityKind;
  readonly verdict: TriageVerdict;
  readonly result: ContentAuditResult;
  readonly distinctSourceCount: number;
  readonly narrativeParagraphs: number;
};

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asCoverage(value: unknown): ResearchCoverageTier | undefined {
  return value === 'minimal' || value === 'partial' || value === 'substantial' ? value : undefined;
}

/**
 * Publisher host for one claim citation. Falls back to the free-text `citationSource` when the
 * claim carries no resolvable href, lower-cased so "NPGallery" and "npgallery" are not counted
 * as two publishers.
 */
export function citationPublisher(claim: unknown): string | null {
  if (claim === null || typeof claim !== 'object') return null;
  const record = claim as Record<string, unknown>;
  const href = record.citationHref;
  if (typeof href === 'string' && href.length > 0) {
    try {
      return new URL(href).hostname.replace(/^www\./iu, '').toLowerCase();
    } catch {
      // fall through to the text source
    }
  }
  const source = record.citationSource;
  return typeof source === 'string' && source.trim().length > 0
    ? source.trim().toLowerCase()
    : null;
}

/** Distinct citation publishers across a projection's claims. */
export function countDistinctSources(claims: unknown): number {
  if (!Array.isArray(claims)) return 0;
  const publishers = new Set<string>();
  for (const claim of claims) {
    const publisher = citationPublisher(claim);
    if (publisher !== null) publishers.add(publisher);
  }
  return publishers.size;
}

/** Case-kind related entries, used by the law spec's case-reference check. */
function countCaseReferences(related: unknown): number {
  if (!Array.isArray(related)) return 0;
  return related.filter((entry) => {
    if (entry === null || typeof entry !== 'object') return false;
    const type = (entry as Record<string, unknown>).type;
    return typeof type === 'string' && type.toLowerCase().includes('case');
  }).length;
}

/**
 * Audits one projection. Returns `null` when the projection carries no id or a kind outside the
 * public ontology — an unaudited record is reported as such rather than being scored against a
 * spec that does not apply to it.
 */
export function auditProjection(projection: AuditableProjection): EntityContentAudit | null {
  const id = asText(projection.id);
  if (id === undefined || typeof projection.kind !== 'string' || !isEntityKind(projection.kind))
    return null;

  const historicalContext = asText(projection.historicalContext);
  const extendedNarrative = asText(projection.extendedNarrative);
  const distinctSourceCount = countDistinctSources(projection.claims);
  const coverage = asCoverage(projection.researchCoverage);

  const result = evaluateContentExpectations({
    id,
    kind: projection.kind,
    narrativeBlocks: [historicalContext, extendedNarrative],
    ...(asText(projection.impactStatement) !== undefined
      ? { impactStatement: asText(projection.impactStatement)! }
      : {}),
    caseReferenceCount: countCaseReferences(projection.related),
    // No case-reference search has ever been recorded for these records. The spec treats an
    // unrecorded search as a failure by design — an unsearched zero is not an attested zero —
    // and this pass does not pretend otherwise by passing a fabricated `true`.
    caseReferenceSearchRecorded: false,
    distinctSourceCount,
    ...(coverage !== undefined ? { researchCoverage: coverage } : {}),
  });

  return {
    entityId: id,
    kind: projection.kind,
    verdict: result.passed ? 'meets_bar' : 'needs_work',
    result,
    distinctSourceCount,
    narrativeParagraphs: [historicalContext, extendedNarrative].filter(Boolean).length,
  };
}

export type TriageSummary = {
  readonly total: number;
  readonly audited: number;
  readonly unauditable: number;
  readonly meetsBar: number;
  readonly needsWork: number;
  /** How many records failed each check, most common first — the work queue, ranked. */
  readonly failuresByCheck: readonly { readonly checkId: string; readonly count: number }[];
  readonly byKind: readonly {
    readonly kind: string;
    readonly meetsBar: number;
    readonly needsWork: number;
  }[];
};

export function summarizeAudits(
  audits: readonly EntityContentAudit[],
  totalRows: number,
): TriageSummary {
  const failureCounts = new Map<string, number>();
  const kindCounts = new Map<string, { meetsBar: number; needsWork: number }>();

  for (const audit of audits) {
    for (const checkId of audit.result.failedCheckIds) {
      failureCounts.set(checkId, (failureCounts.get(checkId) ?? 0) + 1);
    }
    const bucket = kindCounts.get(audit.kind) ?? { meetsBar: 0, needsWork: 0 };
    if (audit.verdict === 'meets_bar') bucket.meetsBar += 1;
    else bucket.needsWork += 1;
    kindCounts.set(audit.kind, bucket);
  }

  return {
    total: totalRows,
    audited: audits.length,
    unauditable: totalRows - audits.length,
    meetsBar: audits.filter((a) => a.verdict === 'meets_bar').length,
    needsWork: audits.filter((a) => a.verdict === 'needs_work').length,
    failuresByCheck: [...failureCounts.entries()]
      .map(([checkId, count]) => ({ checkId, count }))
      .sort((a, b) => b.count - a.count),
    byKind: [...kindCounts.entries()]
      .map(([kind, counts]) => ({ kind, ...counts }))
      .sort((a, b) => b.needsWork - a.needsWork),
  };
}
