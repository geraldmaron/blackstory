/**
 * Pure classification for research intake noise weeding (Track C).
 * Identifies rows safe to dead-letter or park before promote/enrichment passes.
 */
export type WeedAction = 'dead_letter' | 'park' | 'leave';

export type WeedRuleId =
  | 'empty_title'
  | 'mock_test_packet'
  | 'broken_url'
  | 'geo_hold'
  | 'privacy_review_person'
  | 'catalog_duplicate'
  | 'greenbook_living_risk'
  | 'fallback_catalog_url';

export type LandscapeWeedRow = {
  readonly id: string;
  readonly lane: string;
  readonly displayName: string;
  readonly status: string;
  readonly sourceCategory: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly canonicalUrl: string | null;
};

export type WeedClassification = {
  readonly ruleId: WeedRuleId;
  readonly action: WeedAction;
  readonly reason: string;
  readonly targetStatus?: 'dead_letter' | 'quarantined';
};

export type WeedTriageBucket = {
  readonly ruleId: WeedRuleId;
  readonly action: WeedAction;
  readonly reason: string;
  readonly count: number;
  readonly candidateIds: readonly string[];
};

const MOCK_TEST =
  /\b(mock|fixture|test packet|lorem ipsum)\b/i;

const INVALID_URL = /^(?:$|(?!https?:\/\/).+)/i;

/** Coarse Washington, DC bbox — matches bulk-dc-sites-triage.ts */
export const DC_BBOX = {
  minLat: 38.79,
  maxLat: 38.995,
  minLng: -77.12,
  maxLng: -76.9,
} as const;

export function classifyLandscapeWeed(input: {
  readonly row: LandscapeWeedRow;
  readonly catalogDuplicate: boolean;
}): WeedClassification | null {
  const { row } = input;
  if (row.status !== 'pending') return null;

  const name = row.displayName?.trim() ?? '';
  if (name.length === 0) {
    return {
      ruleId: 'empty_title',
      action: 'dead_letter',
      reason: 'empty display_name',
      targetStatus: 'dead_letter',
    };
  }

  if (
    MOCK_TEST.test(row.id) ||
    MOCK_TEST.test(name) ||
    (row.canonicalUrl !== null && MOCK_TEST.test(row.canonicalUrl))
  ) {
    return {
      ruleId: 'mock_test_packet',
      action: 'dead_letter',
      reason: 'mock or test fixture packet',
      targetStatus: 'dead_letter',
    };
  }

  const url = row.canonicalUrl?.trim() ?? '';
  if (url.length === 0 || INVALID_URL.test(url)) {
    return {
      ruleId: 'broken_url',
      action: 'dead_letter',
      reason: 'missing or invalid canonical_url',
      targetStatus: 'dead_letter',
    };
  }

  if (input.catalogDuplicate) {
    return {
      ruleId: 'catalog_duplicate',
      action: 'leave',
      reason: 'fuzzy name+geo match to published release entity — Track B catalog_enrich',
    };
  }

  if (row.lane === 'greenbook') {
    return {
      ruleId: 'greenbook_living_risk',
      action: 'park',
      reason: 'Green Book historic tourist-home address — living/residence review before pin',
      targetStatus: 'quarantined',
    };
  }

  if (row.sourceCategory === 'People') {
    return {
      ruleId: 'privacy_review_person',
      action: 'park',
      reason: 'People-typed site — privacy/living-status review before any public pin',
      targetStatus: 'quarantined',
    };
  }

  const hasGeo =
    typeof row.lat === 'number' &&
    Number.isFinite(row.lat) &&
    typeof row.lng === 'number' &&
    Number.isFinite(row.lng);

  if (!hasGeo) {
    return {
      ruleId: 'geo_hold',
      action: 'park',
      reason: 'missing lat/lng coordinates',
      targetStatus: 'quarantined',
    };
  }

  if (
    row.lane === 'dc-sites' &&
    (row.lat! < DC_BBOX.minLat ||
      row.lat! > DC_BBOX.maxLat ||
      row.lng! < DC_BBOX.minLng ||
      row.lng! > DC_BBOX.maxLng)
  ) {
    return {
      ruleId: 'geo_hold',
      action: 'park',
      reason: 'coordinates outside DC bbox',
      targetStatus: 'quarantined',
    };
  }

  if (url === 'https://catalog.data.gov/dataset/black-history-sites-washington') {
    return {
      ruleId: 'fallback_catalog_url',
      action: 'leave',
      reason: 'data.gov fallback URL — Track B enrichment with historicsites preference',
    };
  }

  return null;
}

export function bucketWeedClassifications(
  rows: readonly { readonly id: string; readonly classification: WeedClassification }[],
): readonly WeedTriageBucket[] {
  const map = new Map<string, WeedTriageBucket>();
  for (const entry of rows) {
    const key = `${entry.classification.ruleId}:${entry.classification.action}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        count: existing.count + 1,
        candidateIds: [...existing.candidateIds, entry.id],
      });
    } else {
      map.set(key, {
        ruleId: entry.classification.ruleId,
        action: entry.classification.action,
        reason: entry.classification.reason,
        count: 1,
        candidateIds: [entry.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
