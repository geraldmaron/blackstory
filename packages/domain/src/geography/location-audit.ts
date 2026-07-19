/**
 * Deterministic location-evidence classification and correction decisions for entity
 * coordinates. No LLM: regex evidence class + Haversine drift vs precision tier.
 *
 * Used by the catalog audit script and operator-cli `locate` so fixture QA, live
 * EntityLocation writes, and publish all share one accept/correct/downgrade policy.
 */
import { haversineMeters, type GeoPoint } from './geohash.js';
import { buildCensusGeocodeQuery } from '../geocode/address-normalize.js';

/** How much site evidence the locationLabel actually carries (not the claimed precision). */
export const LOCATION_EVIDENCE_CLASSES = ['street_address', 'named_place', 'area_only'] as const;
export type LocationEvidenceClass = (typeof LOCATION_EVIDENCE_CLASSES)[number];

/** Max acceptable distance (meters) between stored pin and a fresh geocode for that tier. */
export const LOCATION_DRIFT_THRESHOLDS_METERS = {
  /** Rooftop / street-address institution pins (~exact-site display). */
  institution: 150,
  /** Campus / large-site pins (~block display). */
  campus: 500,
  /** Neighborhood / district — roughly one mile of honest uncertainty. */
  neighborhood: 1_600,
  /** City centroid — only catch transposed/wrong-city errors. */
  city: 25_000,
  county: 80_000,
  state: 500_000,
} as const;

export type LocationDriftTier = keyof typeof LOCATION_DRIFT_THRESHOLDS_METERS;

export const LOCATION_AUDIT_ACTIONS = [
  'keep',
  'correct_coordinates',
  'downgrade_precision',
  'review',
] as const;
export type LocationAuditAction = (typeof LOCATION_AUDIT_ACTIONS)[number];

/** Leading street number + street token (allows ordinals like "6th"). */
const STREET_NUMBER_PATTERN = /\b\d{1,5}\s+[A-Za-z0-9]/;

const STREET_SUFFIXES = new Set([
  'street',
  'st',
  'road',
  'rd',
  'avenue',
  'ave',
  'boulevard',
  'blvd',
  'lane',
  'ln',
  'drive',
  'dr',
  'court',
  'ct',
  'place',
  'pl',
  'terrace',
  'ter',
  'circle',
  'cir',
  'highway',
  'hwy',
  'parkway',
  'pkwy',
  'way',
  'trail',
  'tr',
]);

/**
 * Extract house number + primary street stem from free text for compatibility checks.
 * "2648 West Grand Boulevard" → { number: "2648", stem: "grand" }
 * "2648 W GRAND ST" → { number: "2648", stem: "grand" }
 */
export function extractStreetFingerprint(text: string): { number?: string; stem?: string } {
  const normalized = text
    .toLowerCase()
    .replace(/[.,']/g, ' ')
    .replace(/\b(west|east|north|south|w|e|n|s)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = normalized.match(/\b(\d{1,5})\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,4})/);
  if (!match) return {};
  const number = match[1];
  const tokens = (match[2] ?? '').split(' ').filter(Boolean);
  // Walk forward until a street suffix; stem is the last name token before it.
  let suffixAt = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    if (STREET_SUFFIXES.has(tokens[i]!)) {
      suffixAt = i;
      break;
    }
  }
  if (suffixAt <= 0) return { ...(number ? { number } : {}) };
  const stem = tokens[suffixAt - 1];
  return {
    ...(number ? { number } : {}),
    ...(stem ? { stem } : {}),
  };
}

/**
 * True when the geocode matched address looks like the same street as the query label.
 * Catches Census mismatches like "West Grand Boulevard" → "W GRAND ST".
 */
export function streetAddressesCompatible(locationLabel: string, matchedAddress: string): boolean {
  const a = extractStreetFingerprint(locationLabel);
  const b = extractStreetFingerprint(matchedAddress);
  if (a.number && b.number && a.number !== b.number) return false;
  if (a.stem && b.stem && a.stem !== b.stem) return false;
  // Also reject when the query names a suffix the match replaced with a different one
  // (boulevard vs street) even if stem matches — Motown case.
  const labelLower = locationLabel.toLowerCase();
  const matchLower = matchedAddress.toLowerCase();
  const labelHasBlvd = /\b(boulevard|blvd)\b/.test(labelLower);
  const matchHasBlvd = /\b(boulevard|blvd)\b/.test(matchLower);
  const matchHasSt = /\b(street|st)\b/.test(matchLower);
  if (labelHasBlvd && !matchHasBlvd && matchHasSt) return false;
  return true;
}


/** Labels that are clearly city/area phrasing even if precision is finer. */
const AREA_ONLY_HINT =
  /\b(area|region|county|parish|metro|metropolitan|greater)\b|\(.*\b(site|massacre|arrest)\b.*\)/i;

export type ClassifyLocationEvidenceInput = {
  readonly locationLabel: string;
  readonly locationPrecision: string;
};

/**
 * Classify evidence quality from the label + declared precision.
 * Street numbers win; city/county/state (and neighborhood without a place name) are area-only;
 * everything else is a named place (campus, museum, base, park).
 */
export function classifyLocationEvidence(input: ClassifyLocationEvidenceInput): LocationEvidenceClass {
  const label = input.locationLabel.trim();
  if (STREET_NUMBER_PATTERN.test(label)) return 'street_address';

  const precision = input.locationPrecision.trim().toLowerCase();
  if (precision === 'city' || precision === 'county' || precision === 'state' || precision === 'country') {
    return 'area_only';
  }
  if (precision === 'neighborhood' && AREA_ONLY_HINT.test(label)) {
    return 'area_only';
  }
  if (precision === 'neighborhood') {
    // Named neighborhood/district without a street — treat as named place at neighborhood scale.
    return 'named_place';
  }
  return 'named_place';
}

export function driftThresholdMeters(precision: string): number {
  const key = precision.trim().toLowerCase() as LocationDriftTier;
  return LOCATION_DRIFT_THRESHOLDS_METERS[key] ?? LOCATION_DRIFT_THRESHOLDS_METERS.city;
}

/** Suggested public precision when evidence cannot support the claimed tier. */
export function suggestedPrecisionForEvidence(
  evidence: LocationEvidenceClass,
  claimedPrecision: string,
): string {
  const claimed = claimedPrecision.trim().toLowerCase();
  if (evidence === 'street_address') {
    return claimed === 'campus' ? 'campus' : 'institution';
  }
  if (evidence === 'named_place') {
    // Named places without a street number are campus/neighborhood scale, never rooftop.
    if (claimed === 'campus' || claimed === 'institution') return 'campus';
    if (claimed === 'neighborhood') return 'neighborhood';
    return 'neighborhood';
  }
  // area_only
  if (claimed === 'institution' || claimed === 'campus' || claimed === 'neighborhood') {
    return 'city';
  }
  return claimed || 'city';
}

export type LocationGeocodeHit = {
  readonly lat: number;
  readonly lng: number;
  readonly matchedAddress?: string;
  readonly stateName?: string;
  readonly method: 'geocode_census' | 'geocode_other';
};

export type DecideLocationCorrectionInput = {
  readonly entityId: string;
  readonly locationLabel: string;
  readonly locationPrecision: string;
  readonly jurisdictionLabel: string;
  readonly stored: GeoPoint;
  /** Fresh geocode; omit when the geocoder returned no usable match. */
  readonly geocode?: LocationGeocodeHit;
  /** True when stored point fails the state-bbox check for jurisdictionLabel. */
  readonly outsideStateBbox?: boolean;
};

export type LocationCorrectionDecision = {
  readonly entityId: string;
  readonly evidenceClass: LocationEvidenceClass;
  readonly action: LocationAuditAction;
  readonly reason: string;
  readonly driftMeters?: number;
  readonly thresholdMeters: number;
  readonly suggestedPrecision: string;
  readonly corrected?: GeoPoint;
  readonly matchMethod?: LocationGeocodeHit['method'];
  readonly matchedAddress?: string;
};

function jurisdictionStateTail(jurisdictionLabel: string): string {
  return jurisdictionLabel.split(',').pop()?.trim() ?? '';
}

function statesRoughlyMatch(jurisdictionLabel: string, geocodeStateName?: string): boolean {
  if (!geocodeStateName) return true;
  const tail = jurisdictionStateTail(jurisdictionLabel).toLowerCase();
  const geo = geocodeStateName.toLowerCase();
  if (tail === geo) return true;
  if (/^d\.?c\.?$|district of columbia/i.test(tail) && /district of columbia|columbia/i.test(geo)) {
    return true;
  }
  return geo.includes(tail) || tail.includes(geo);
}

/**
 * Pure decision: keep, snap to geocode, downgrade precision, or queue human review.
 * Auto-correct only for street-address evidence with a Census (or other) match inside the
 * declared state and beyond the tier drift threshold — never invent a sharper pin for area-only.
 */
export function decideLocationCorrection(input: DecideLocationCorrectionInput): LocationCorrectionDecision {
  const evidenceClass = classifyLocationEvidence({
    locationLabel: input.locationLabel,
    locationPrecision: input.locationPrecision,
  });
  const thresholdMeters = driftThresholdMeters(input.locationPrecision);
  const suggestedPrecision = suggestedPrecisionForEvidence(evidenceClass, input.locationPrecision);

  if (input.outsideStateBbox) {
    if (input.geocode && statesRoughlyMatch(input.jurisdictionLabel, input.geocode.stateName)) {
      return {
        entityId: input.entityId,
        evidenceClass,
        action: 'correct_coordinates',
        reason: 'stored coordinates outside jurisdiction state bbox; geocode is inside declared state',
        thresholdMeters,
        suggestedPrecision,
        corrected: { lat: input.geocode.lat, lng: input.geocode.lng },
        matchMethod: input.geocode.method,
        ...(input.geocode.matchedAddress ? { matchedAddress: input.geocode.matchedAddress } : {}),
      };
    }
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'review',
      reason: 'stored coordinates outside jurisdiction state bbox and no in-state geocode',
      thresholdMeters,
      suggestedPrecision: 'city',
    };
  }

  if (evidenceClass === 'area_only') {
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'keep',
      reason: 'area-only evidence — do not sharpen beyond declared city/area precision',
      thresholdMeters,
      suggestedPrecision,
    };
  }

  if (!input.geocode) {
    if (
      evidenceClass === 'named_place' &&
      (input.locationPrecision === 'institution' || input.locationPrecision === 'campus')
    ) {
      return {
        entityId: input.entityId,
        evidenceClass,
        action: 'review',
        reason: 'named place did not geocode; verify pin or downgrade precision before publish',
        thresholdMeters,
        suggestedPrecision,
      };
    }
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'keep',
      reason: 'no geocode match; retaining manual_research coordinates',
      thresholdMeters,
      suggestedPrecision,
    };
  }

  if (!statesRoughlyMatch(input.jurisdictionLabel, input.geocode.stateName)) {
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'review',
      reason: `geocode state "${input.geocode.stateName ?? '?'}" disagrees with jurisdiction "${input.jurisdictionLabel}"`,
      thresholdMeters,
      suggestedPrecision,
    };
  }

  const driftMeters = Math.round(
    haversineMeters(input.stored, { lat: input.geocode.lat, lng: input.geocode.lng }),
  );

  if (driftMeters <= thresholdMeters) {
    const keep: LocationCorrectionDecision = {
      entityId: input.entityId,
      evidenceClass,
      action: 'keep',
      reason: `within ${thresholdMeters}m drift threshold for ${input.locationPrecision}`,
      driftMeters,
      thresholdMeters,
      suggestedPrecision: input.locationPrecision,
    };
    // Street matches already close may optionally snap; callers can ignore corrected.
    if (evidenceClass === 'street_address') {
      return {
        ...keep,
        corrected: { lat: input.geocode.lat, lng: input.geocode.lng },
        matchMethod: input.geocode.method,
        ...(input.geocode.matchedAddress ? { matchedAddress: input.geocode.matchedAddress } : {}),
      };
    }
    return keep;
  }

  if (evidenceClass === 'street_address') {
    if (
      input.geocode.matchedAddress &&
      !streetAddressesCompatible(input.locationLabel, input.geocode.matchedAddress)
    ) {
      return {
        entityId: input.entityId,
        evidenceClass,
        action: 'review',
        reason: `Census matched address looks like a different street than the label ("${input.geocode.matchedAddress}")`,
        driftMeters,
        thresholdMeters,
        suggestedPrecision: input.locationPrecision,
      };
    }
    // Very large street drifts are usually bad matches even when tokens look similar.
    if (driftMeters > 2_000) {
      return {
        entityId: input.entityId,
        evidenceClass,
        action: 'review',
        reason: `street-address geocode ${driftMeters}m away exceeds 2km safety cap — human verify before snapping`,
        driftMeters,
        thresholdMeters,
        suggestedPrecision: input.locationPrecision,
      };
    }
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'correct_coordinates',
      reason: `street-address geocode ${driftMeters}m from stored pin (threshold ${thresholdMeters}m)`,
      driftMeters,
      thresholdMeters,
      suggestedPrecision: input.locationPrecision === 'campus' ? 'campus' : 'institution',
      corrected: { lat: input.geocode.lat, lng: input.geocode.lng },
      matchMethod: input.geocode.method,
      ...(input.geocode.matchedAddress ? { matchedAddress: input.geocode.matchedAddress } : {}),
    };
  }

  // named_place with large drift: prefer review over blind snap (place geocoders often hit
  // the wrong building on a large campus/base).
  if (driftMeters > thresholdMeters * 4) {
    return {
      entityId: input.entityId,
      evidenceClass,
      action: 'review',
      reason: `named-place geocode ${driftMeters}m away — ambiguous place match, needs human check`,
      driftMeters,
      thresholdMeters,
      suggestedPrecision,
    };
  }

  return {
    entityId: input.entityId,
    evidenceClass,
    action: 'correct_coordinates',
    reason: `named-place geocode ${driftMeters}m from stored pin (threshold ${thresholdMeters}m)`,
    driftMeters,
    thresholdMeters,
    suggestedPrecision,
    corrected: { lat: input.geocode.lat, lng: input.geocode.lng },
    matchMethod: input.geocode.method,
    ...(input.geocode.matchedAddress ? { matchedAddress: input.geocode.matchedAddress } : {}),
  };
}

/** Build the one-line geocode query from catalog fields (street-preferring, Census-oriented). */
export function buildLocationGeocodeQuery(locationLabel: string, jurisdictionLabel: string): string {
  return buildCensusGeocodeQuery(locationLabel, jurisdictionLabel);
}

/**
 * Best-effort English Wikipedia title from a catalog locationLabel.
 * "Howard University, Washington, D.C." → "Howard University"
 */
export function placeTitleCandidateFromLabel(locationLabel: string): string {
  return placeTitleCandidatesFromLabel(locationLabel)[0] ?? locationLabel.trim();
}

/**
 * Ordered Wikidata/enwiki title guesses for a catalog locationLabel.
 * Tries the head segment first, then parent sites (university, space center, cemetery, …).
 * Never emits bare US state / DC jurisdiction tails (those resolve to state centroids).
 */
export function placeTitleCandidatesFromLabel(locationLabel: string): readonly string[] {
  const cleaned = locationLabel
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const beforeStreet = cleaned.split(/\b\d{1,5}\s+[A-Za-z0-9]/)[0]?.trim();
  const head = (beforeStreet && beforeStreet.length >= 3 ? beforeStreet : cleaned).replace(/,\s*$/, '');
  const segments = head
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  const out: string[] = [];
  const push = (value: string | undefined) => {
    const v = value?.trim();
    if (!v || v.length < 3) return;
    if (isJurisdictionOnlyPlaceTitle(v)) return;
    if (out.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    out.push(v);
  };

  // Head only — do not emit every comma segment (cities/states pollute Wikidata matches).
  push(segments[0] ?? head);

  const parentHint =
    /\b(university|college|hospital|cemetery|museum|library|space center|research center|air force base|naval|fort|park|church|cathedral|institute|academy|refuge|plantation|battlefield)\b/i;
  for (const seg of segments.slice(1)) {
    if (parentHint.test(seg)) push(seg);
  }

  if (out.length === 0 && !isJurisdictionOnlyPlaceTitle(head)) push(head);
  return out;
}

const US_STATE_PLACE_TITLES = new Set(
  [
    'alabama',
    'alaska',
    'arizona',
    'arkansas',
    'california',
    'colorado',
    'connecticut',
    'delaware',
    'florida',
    'georgia',
    'hawaii',
    'idaho',
    'illinois',
    'indiana',
    'iowa',
    'kansas',
    'kentucky',
    'louisiana',
    'maine',
    'maryland',
    'massachusetts',
    'michigan',
    'minnesota',
    'mississippi',
    'missouri',
    'montana',
    'nebraska',
    'nevada',
    'new hampshire',
    'new jersey',
    'new mexico',
    'new york',
    'north carolina',
    'north dakota',
    'ohio',
    'oklahoma',
    'oregon',
    'pennsylvania',
    'rhode island',
    'south carolina',
    'south dakota',
    'tennessee',
    'texas',
    'utah',
    'vermont',
    'virginia',
    'washington',
    'west virginia',
    'wisconsin',
    'wyoming',
    'district of columbia',
    'd.c.',
    'dc',
    'washington d.c.',
    'washington dc',
  ].map((s) => s.toLowerCase()),
);

/** True when a title is only a US state / DC (unsafe as a Wikidata pin source). */
export function isJurisdictionOnlyPlaceTitle(title: string): boolean {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ');
  return US_STATE_PLACE_TITLES.has(normalized);
}

