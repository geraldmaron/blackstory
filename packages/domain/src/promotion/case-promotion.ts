/**
 * Case → canonical entity promotion authority (repo-k2kb).
 *
 * Before this module, the only working path from a research case to a canonical entity was an
 * untracked, gitignored script that ran raw SQL by hand. This is pure, DB-free logic two
 * functions a caller (apps/admin's promote-case.ts) must both pass before writing anything:
 *
 *  - `evaluateCasePromotionGate`: the *authority* check. Mirrors `evaluatePromotionGate`
 *    (./controls.ts)'s core invariant proposer and approver can never be the same identity
 *    plus a case-state eligibility check. This is deliberately NOT reused as-is: that gate
 *    operates on a `PromotionClaim` shape (contradiction-search records, evidence-lineage
 *    reputation) this pipeline has never populated; forcing case data into that shape would
 *    fabricate fields no one actually assessed. This is a smaller, honest gate for what this
 *    pipeline actually has.
 *  - `validateCanonicalPromotionRecord`: the *content* check ports the validation rules the
 *    ad hoc script enforced by hand (two independent source hosts, US coordinate bounds,
 *    well-formed decade buckets, non-trivial summary) so they run before every promotion, not
 *    just the one the script's author remembered to check manually.
 */

/** Case states the ad hoc script treated as "ready" the enrichment tier is complete. */
const ELIGIBLE_CASE_STATES = new Set(['substantial_enrichment']);

export type CasePromotionGateReason =
  | 'case_not_ready'
  | 'proposer_approver_conflict'
  | 'missing_identity';

export type CasePromotionGateResult = {
  readonly approved: boolean;
  readonly reasons: readonly CasePromotionGateReason[];
};

export function evaluateCasePromotionGate(input: {
  readonly caseState: string;
  readonly proposerId: string;
  readonly approverId: string;
}): CasePromotionGateResult {
  const reasons = new Set<CasePromotionGateReason>();
  if (!input.proposerId.trim() || !input.approverId.trim()) {
    reasons.add('missing_identity');
  } else if (input.proposerId === input.approverId) {
    reasons.add('proposer_approver_conflict');
  }
  if (!ELIGIBLE_CASE_STATES.has(input.caseState)) {
    reasons.add('case_not_ready');
  }
  return { approved: reasons.size === 0, reasons: [...reasons] };
}

export type CanonicalPromotionSource = {
  readonly url: string;
  readonly title: string;
  readonly excerpt: string;
  readonly fitness: 'authoritative' | 'strong' | 'weak';
  /** Cited only for where the place is, not for a substantive historical claim. */
  readonly locationOnly?: boolean;
};

export type CanonicalPromotionLocation = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision: string;
  readonly matchMethod: string;
  readonly zip?: string;
  readonly accessNote?: string;
};

export type CanonicalPromotionRecord = {
  readonly entityId: string;
  readonly displayName: string;
  readonly aliases?: readonly string[];
  readonly summary: string;
  readonly jurisdiction: string;
  readonly topicIds: readonly string[];
  readonly topicTags: readonly string[];
  /** e.g. "1930s" each must match /^(17|18|19|20)\d0s$/. */
  readonly eraBuckets: readonly string[];
  readonly location: CanonicalPromotionLocation;
  readonly sources: readonly CanonicalPromotionSource[];
};

const DECADE_BUCKET_PATTERN = /^(17|18|19|20)\d0s$/u;
/** Continental US + AK/HI-ish generous bounding box, matching the script this replaces. */
const US_LAT_RANGE = [18, 72] as const;
const US_LNG_RANGE = [-180, -60] as const;

export type CanonicalPromotionValidationReason =
  | 'name_or_summary_invalid'
  | 'insufficient_independent_source_hosts'
  | 'invalid_source'
  | 'coordinates_outside_us_bounds'
  | 'invalid_decade_bucket';

export type CanonicalPromotionValidation = {
  readonly valid: boolean;
  readonly reasons: readonly CanonicalPromotionValidationReason[];
};

function sourceHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Pure port of the ad hoc script's per-record validation (validateInputs). */
export function validateCanonicalPromotionRecord(
  record: CanonicalPromotionRecord,
): CanonicalPromotionValidation {
  const reasons = new Set<CanonicalPromotionValidationReason>();

  if (!record.displayName.trim() || record.summary.length < 80 || record.summary.length > 600) {
    reasons.add('name_or_summary_invalid');
  }

  const claimSources = record.sources.filter((source) => !source.locationOnly);
  const hosts = new Set(
    claimSources.map((source) => sourceHostname(source.url)).filter((host): host is string => !!host),
  );
  if (claimSources.length < 2 || hosts.size < 2) {
    reasons.add('insufficient_independent_source_hosts');
  }

  for (const source of record.sources) {
    let isHttps = false;
    try {
      isHttps = new URL(source.url).protocol === 'https:';
    } catch {
      isHttps = false;
    }
    if (!isHttps || source.excerpt.length < 70) {
      reasons.add('invalid_source');
    }
  }

  const [minLat, maxLat] = US_LAT_RANGE;
  const [minLng, maxLng] = US_LNG_RANGE;
  if (
    record.location.lat < minLat ||
    record.location.lat > maxLat ||
    record.location.lng < minLng ||
    record.location.lng > maxLng
  ) {
    reasons.add('coordinates_outside_us_bounds');
  }

  if (record.eraBuckets.some((bucket) => !DECADE_BUCKET_PATTERN.test(bucket))) {
    reasons.add('invalid_decade_bucket');
  }

  return { valid: reasons.size === 0, reasons: [...reasons] };
}
