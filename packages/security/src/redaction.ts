/**
 * Central redaction primitives for Black Book (BB-015).
 *
 * This module is the single policy-driven engine that reduces location precision
 * before publication and scrubs protected values (residential addresses, exact
 * coordinates) out of any serialized payload — public projections, search index
 * documents, logs, error telemetry, and exports. All rules derive from the product
 * constitution (@black-book/schemas); nothing here weakens those rules.
 */
import { evaluatePublicPrecision, loadProductConstitution } from '@black-book/schemas';
import { treatAsLiving, type LivingStatus } from '@black-book/domain';
import {
  isResidentialPrecision,
  type PrecisionReductionReason,
  type SensitivityClass,
} from './sensitivity.js';

/** Coarse-to-fine ordering used to guarantee reductions only ever lower precision. */
const PRECISION_RANK: Readonly<Record<string, number>> = {
  none: 0,
  country: 1,
  state: 2,
  county: 3,
  city: 4,
  neighborhood: 5,
  institution: 6,
  campus: 6,
  residence: 7,
  street_address: 8,
  unit: 9,
  parcel: 10,
  exact_coordinates: 11,
};

function rankOf(precision: string): number {
  return PRECISION_RANK[precision] ?? Number.POSITIVE_INFINITY;
}

/** Number of decimal places kept when coarsening coordinates for a public precision. */
const COORDINATE_DECIMALS: Readonly<Record<string, number>> = {
  country: 0,
  state: 1,
  county: 1,
  city: 2,
  neighborhood: 3,
  institution: 4,
  campus: 4,
};

/** Geohash length kept for a public precision level (shorter = coarser). */
const GEOHASH_LENGTH: Readonly<Record<string, number>> = {
  country: 1,
  state: 2,
  county: 3,
  city: 4,
  neighborhood: 5,
  institution: 6,
  campus: 6,
};

export type LivingStatusInput = LivingStatus | undefined;

export type PrecisionReductionInput = {
  /** Source precision (evidence or internal tier) to reduce for public output. */
  readonly precision: string;
  readonly livingStatus?: LivingStatusInput;
  readonly sensitivityClass?: SensitivityClass;
  /** True when the residence is a currently occupied private residence. */
  readonly occupiedPrivateResidence?: boolean;
  /** True when exact coordinates are genuinely required for the public purpose. */
  readonly neededForPublic?: boolean;
};

export type PrecisionReductionResult = {
  readonly precision: string;
  readonly reduced: boolean;
  readonly reason?: PrecisionReductionReason;
  readonly policyVersion: string;
};

/** Reduce a precision to the coarser of itself and a target level. */
function reduceTo(current: string, target: string): string {
  return rankOf(target) < rankOf(current) ? target : current;
}

/**
 * Reduce a source precision to a value that is safe to publish.
 *
 * Ordering matters: living-residential and occupied-private-residence checks run
 * before the generic prohibited-level check so callers receive the most specific
 * reduction reason. Unknown living status is treated as living (constitution).
 */
export function reducePublicPrecision(input: PrecisionReductionInput): PrecisionReductionResult {
  const policy = loadProductConstitution();
  const rules = policy.sensitivityRules;
  const precisionRules = policy.publicPrecisionRules;
  const policyVersion = policy.policyVersion;
  const status: LivingStatus = input.livingStatus ?? 'unknown';
  const living = treatAsLiving(status);
  const source = input.precision;
  const residential = isResidentialPrecision(source);

  const keep = (): PrecisionReductionResult => ({
    precision: source,
    reduced: false,
    policyVersion,
  });
  const reduce = (target: string, reason: PrecisionReductionReason): PrecisionReductionResult => ({
    precision: reduceTo(source, target),
    reduced: true,
    reason,
    policyVersion,
  });

  // Unknown / unclassified precision → drop to nothing (fail closed).
  if (
    !precisionRules.allowedLevels.includes(source) &&
    !precisionRules.prohibitedLevels.includes(source)
  ) {
    return reduce('none', 'unknown_precision_level');
  }

  // Living (or unknown) residential precision is never published.
  if (living && residential && precisionRules.livingResidentialProhibited) {
    return reduce(
      rules.livingResidenceMaxPublicPrecision,
      'living_residential_precision_prohibited',
    );
  }

  // Occupied private residence of a deceased person is reduced too.
  if (
    !living &&
    residential &&
    input.occupiedPrivateResidence === true &&
    rules.reduceOccupiedPrivateResidenceForDeceased
  ) {
    return reduce(
      rules.occupiedPrivateResidenceMaxPublicPrecision,
      'occupied_private_residence_reduced',
    );
  }

  // Any remaining prohibited precision (deceased historical residence, exact coords, parcel).
  if (precisionRules.prohibitedLevels.includes(source)) {
    const reason: PrecisionReductionReason =
      source === 'exact_coordinates'
        ? 'exact_coordinates_reduced'
        : 'prohibited_location_precision';
    return reduce(rules.occupiedPrivateResidenceMaxPublicPrecision, reason);
  }

  // Sensitive sites are capped even when the raw level is otherwise allowed.
  if (
    input.sensitivityClass === 'sensitive_site' &&
    rankOf(source) > rankOf(rules.sensitiveSiteMaxPublicPrecision)
  ) {
    return reduce(rules.sensitiveSiteMaxPublicPrecision, 'sensitivity_class_reduced');
  }

  // Exact coordinates not needed for the public purpose are trimmed when configured.
  if (
    source === 'exact_coordinates' &&
    precisionRules.reduceExactCoordinatesWhenNotNeeded &&
    input.neededForPublic !== true
  ) {
    return reduce(rules.occupiedPrivateResidenceMaxPublicPrecision, 'not_needed_for_public');
  }

  // Defensive: confirm the final level is publishable for this living status.
  const check = evaluatePublicPrecision(
    source,
    input.livingStatus === undefined ? {} : { livingStatus: input.livingStatus },
  );
  if (!check.allowed) {
    return reduce('city', check.reason ?? 'prohibited_location_precision');
  }

  return keep();
}

export type InternalLocationInput = {
  readonly precision: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly livingStatus?: LivingStatusInput;
  readonly sensitivityClass?: SensitivityClass;
  readonly occupiedPrivateResidence?: boolean;
  readonly neededForPublic?: boolean;
};

export type PublicLocation = {
  readonly precision: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly reductionReason?: PrecisionReductionReason;
};

function coarsenCoordinate(value: number, precision: string): number | undefined {
  const decimals = COORDINATE_DECIMALS[precision];
  if (decimals === undefined) {
    return undefined;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Produce a public-safe location, or `undefined` when nothing may be shown.
 * Exact coordinates, street/unit/parcel labels, and fine geohashes are stripped;
 * coordinates and geohash are coarsened to match the reduced precision (protects maps).
 */
export function redactLocationForPublic(
  location: InternalLocationInput,
): PublicLocation | undefined {
  const reduction = reducePublicPrecision({
    precision: location.precision,
    ...(location.livingStatus === undefined ? {} : { livingStatus: location.livingStatus }),
    ...(location.sensitivityClass === undefined
      ? {}
      : { sensitivityClass: location.sensitivityClass }),
    ...(location.occupiedPrivateResidence === undefined
      ? {}
      : { occupiedPrivateResidence: location.occupiedPrivateResidence }),
    ...(location.neededForPublic === undefined
      ? {}
      : { neededForPublic: location.neededForPublic }),
  });

  const precision = reduction.precision;
  if (precision === 'none' || rankOf(precision) === 0) {
    return undefined;
  }

  const result: {
    precision: string;
    lat?: number;
    lng?: number;
    geohash?: string;
    matchMethod?: string;
    label?: string;
    reductionReason?: PrecisionReductionReason;
  } = { precision };

  if (location.lat !== undefined && location.lng !== undefined) {
    const lat = coarsenCoordinate(location.lat, precision);
    const lng = coarsenCoordinate(location.lng, precision);
    if (lat !== undefined && lng !== undefined) {
      result.lat = lat;
      result.lng = lng;
    }
  }

  if (location.geohash) {
    const length = GEOHASH_LENGTH[precision];
    if (length !== undefined) {
      result.geohash = location.geohash.slice(0, length);
    }
  }

  if (location.matchMethod) {
    result.matchMethod = location.matchMethod;
  }

  // Only keep labels that were not reduced and carry no address-shaped content.
  if (!reduction.reduced && location.label && !containsProtectedText(location.label)) {
    result.label = location.label;
  }

  if (reduction.reason) {
    result.reductionReason = reduction.reason;
  }

  return result;
}

/** Object keys whose values are treated as protected and always redacted. */
export const PROTECTED_FIELD_KEYS: readonly string[] = [
  'address',
  'addressline',
  'addressline1',
  'addressline2',
  'streetaddress',
  'street',
  'housenumber',
  'house_number',
  'apt',
  'apartment',
  'unit',
  'unitnumber',
  'parcel',
  'parcelid',
  'residence',
  'residentialaddress',
  'homeaddress',
  'exactcoordinates',
  'lat',
  'latitude',
  'lng',
  'lon',
  'longitude',
  'geo',
  'coordinates',
];

const PROTECTED_KEY_SET = new Set(PROTECTED_FIELD_KEYS);

const REDACTED = '[REDACTED]';

/** US street-address shaped text (number + street name + street-type suffix). */
const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)*\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|circle|cir|highway|hwy|parkway|pkwy|square|sq|trail|trl|apartment|apt|suite|ste|unit)\b\.?/gi;

/** High-precision coordinate pairs (≥4 decimals) that could pinpoint a residence. */
const EXACT_COORDINATE_PATTERN = /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g;

function containsProtectedText(value: string): boolean {
  STREET_ADDRESS_PATTERN.lastIndex = 0;
  EXACT_COORDINATE_PATTERN.lastIndex = 0;
  return STREET_ADDRESS_PATTERN.test(value) || EXACT_COORDINATE_PATTERN.test(value);
}

function scrubString(value: string): string {
  return value
    .replace(STREET_ADDRESS_PATTERN, REDACTED)
    .replace(EXACT_COORDINATE_PATTERN, REDACTED);
}

export type RedactorOptions = {
  /** Additional object keys (case-insensitive) to redact. */
  readonly extraKeys?: readonly string[];
  /** When true, protected keys are omitted entirely instead of masked. */
  readonly dropKeys?: boolean;
  readonly maxDepth?: number;
};

/**
 * Build a deep redactor that strips protected values from arbitrary structures.
 * Used for logs, error telemetry, and exports so residential addresses and exact
 * coordinates never leave the system through a side channel.
 */
export function createSensitiveDataRedactor(
  options: RedactorOptions = {},
): (value: unknown) => unknown {
  const keySet = new Set(PROTECTED_KEY_SET);
  for (const key of options.extraKeys ?? []) {
    keySet.add(key.toLowerCase());
  }
  const maxDepth = options.maxDepth ?? 8;

  function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (typeof value === 'string') {
      return scrubString(value);
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (depth >= maxDepth) {
      return REDACTED;
    }
    if (seen.has(value as object)) {
      return REDACTED;
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (keySet.has(key.toLowerCase())) {
        if (options.dropKeys !== true) {
          out[key] = REDACTED;
        }
      } else {
        out[key] = walk(entry, depth + 1, seen);
      }
    }
    return out;
  }

  return (value: unknown) => walk(value, 0, new WeakSet<object>());
}

/** Convenience: deep-redact a value with default protected keys. */
export function redactSensitiveValues(value: unknown): unknown {
  return createSensitiveDataRedactor()(value);
}
