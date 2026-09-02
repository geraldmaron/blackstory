/**
 * Central redaction primitives for BlackStory.
 *
 * This module is the single policy-driven engine that reduces location precision
 * before publication and scrubs protected values (residential addresses, exact
 * coordinates) out of any serialized payload public projections, search index
 * documents, logs, error telemetry, and exports. All rules derive from the product
 * constitution (@repo/schemas) and from `docs/security/location-precision-standard.md`
 * (the location precision standard, repo-wqcn); nothing here weakens those rules.
 *
 * `reducePublicPrecision` runs INSIDE the publish path itself (the release builder,
 * `packages/domain/src/publication/release-builder.ts`) for every `bb_public.release_entities`
 * projection — it is not merely a library other code may choose to call before serializing.
 * See the standard's §4 "One engine on the publish path."
 */
import { loadProductConstitution } from '@repo/schemas';
import { treatAsLiving, type LivingStatus } from '@repo/domain-core/living';
import {
  normalizePublicPrecision,
  PUBLIC_PRECISION_TIERS,
  type PublicPrecisionTier,
} from '@repo/domain-core/geography/precision';
import type { PrecisionReductionReason, SensitivityClass } from './sensitivity.js';

/** Coarse-to-fine ordering over the controlled public precision tiers (standard §2). */
const PRECISION_RANK: Readonly<Record<PublicPrecisionTier, number>> = Object.fromEntries(
  PUBLIC_PRECISION_TIERS.map((tier, index) => [tier, index]),
) as Readonly<Record<PublicPrecisionTier, number>>;

function rankOf(precision: PublicPrecisionTier): number {
  return PRECISION_RANK[precision];
}

/** Number of decimal places kept when coarsening coordinates for a public precision (standard §2). */
const COORDINATE_DECIMALS: Readonly<Record<PublicPrecisionTier, number | undefined>> = {
  none: undefined,
  country: 0,
  state: 1,
  county: 1,
  city: 2,
  neighborhood: 3,
  campus: 3,
  institution: 4,
  site: 4,
  address: 4,
};

/** Geohash length kept for a public precision level (shorter = coarser). */
const GEOHASH_LENGTH: Readonly<Record<PublicPrecisionTier, number | undefined>> = {
  none: undefined,
  country: 1,
  state: 2,
  county: 3,
  city: 4,
  neighborhood: 5,
  campus: 5,
  institution: 6,
  site: 7,
  address: 7,
};

export type LivingStatusInput = LivingStatus | undefined;

export type PrecisionReductionInput = {
  /** Source precision (raw evidence/geocode value, or an already-controlled tier). */
  readonly precision: string;
  readonly livingStatus?: LivingStatusInput;
  readonly sensitivityClass?: SensitivityClass;
  /** Entity kind ('person', 'place', ...). Drives the living-residence rule: it only fires on
   * the biographical axis (a person record), never on a place's own architectural record. */
  readonly kind?: string;
  /** @deprecated no longer changes the reduction outcome — NRHP publishes a deceased owner's
   * occupied residence at full address (standard §3); kept only so existing callers compile. */
  readonly occupiedPrivateResidence?: boolean;
  /** @deprecated exact_coordinates is unconditionally a prohibited raw level now (standard §2);
   * kept only so existing callers compile. */
  readonly neededForPublic?: boolean;
};

export type PrecisionReductionResult = {
  readonly precision: PublicPrecisionTier;
  readonly reduced: boolean;
  readonly reason?: PrecisionReductionReason;
  readonly policyVersion: string;
};

/** Reduce a precision to the coarser of itself and a target level. */
function reduceTo(current: PublicPrecisionTier, target: PublicPrecisionTier): PublicPrecisionTier {
  return rankOf(target) < rankOf(current) ? target : current;
}

/**
 * Reduce a source precision to a value that is safe to publish, per
 * `docs/security/location-precision-standard.md` §3.
 *
 * Fixed order (most specific/urgent first):
 * 1. `withheld_on_request` always wins — an operator/owner/descendant request to withhold.
 * 2. A raw prohibited level (unit/parcel/exact_coordinates/residence) fails closed to `city`,
 *    checked against the RAW input so it is distinguishable from an ordinary unknown-value
 *    normalisation.
 * 3. The living-residence rule: only when `livingStatus` is living or unknown (fail-safe
 *    default), AND only on the biographical axis (`kind === 'person'`, or a place whose
 *    `sensitivityClass` is `living_residence`) — NRHP does not cap an occupied building on the
 *    architectural axis.
 * 4. `restricted_site` (and its legacy alias `sensitive_site`) caps to `city`.
 * 5. `memorial_site`, `violence_associated`, `enslaver_or_segregationist`,
 *    `perpetrator_associated` — no reduction; these classes publish at source precision.
 * 6. Otherwise the raw precision is normalised onto the controlled tier list and kept as-is.
 */
export function reducePublicPrecision(input: PrecisionReductionInput): PrecisionReductionResult {
  const policy = loadProductConstitution();
  const rules = policy.sensitivityRules;
  const precisionRules = policy.publicPrecisionRules;
  const policyVersion = policy.policyVersion;
  const status: LivingStatus = input.livingStatus ?? 'unknown';
  const living = treatAsLiving(status);
  const normalized = normalizePublicPrecision(input.precision);

  const keep = (): PrecisionReductionResult => ({
    precision: normalized,
    reduced: false,
    policyVersion,
  });
  const reduce = (
    target: PublicPrecisionTier,
    reason: PrecisionReductionReason,
  ): PrecisionReductionResult => ({
    precision: reduceTo(normalized, target),
    reduced: true,
    reason,
    policyVersion,
  });

  // 1. Withheld on request always wins, before any other rule (§3, §4 "A request path").
  if (input.sensitivityClass === 'withheld_on_request') {
    return reduce('none', 'withheld_on_request');
  }

  // 2. A raw prohibited level fails closed, checked against the RAW value (not the normalised
  // one — normalizePublicPrecision would otherwise silently collapse this into an ordinary
  // "unknown value -> city" case with the wrong reason code).
  const rawTrimmed = input.precision.trim().toLowerCase();
  if (precisionRules.prohibitedLevels.includes(rawTrimmed)) {
    const reason: PrecisionReductionReason =
      rawTrimmed === 'exact_coordinates'
        ? 'exact_coordinates_reduced'
        : 'prohibited_location_precision';
    return reduce('city', reason);
  }

  // 3. Living-residence rule: fires only on the biographical axis. treatAsLiving('unknown') is
  // true by constitution policy (treatUnknownAsLiving), so an unrecorded status fails safe.
  const onBiographicalAxis =
    input.kind === 'person' || input.sensitivityClass === 'living_residence';
  if (living && onBiographicalAxis) {
    const reason: PrecisionReductionReason =
      status === 'living' ? 'living_residence' : 'living_status_unknown';
    return reduce(rules.livingResidenceMaxPublicPrecision as PublicPrecisionTier, reason);
  }

  // 4. Restricted/sacred/archaeological sites — the § 307103 "Address Restricted" tier.
  // "sensitive_site" is kept as the legacy alias of "restricted_site" (standard §3).
  if (input.sensitivityClass === 'restricted_site' || input.sensitivityClass === 'sensitive_site') {
    return reduce(rules.restrictedSiteMaxPublicPrecision as PublicPrecisionTier, 'restricted_site');
  }

  // 5. Memorial and violence-history classes: no reduction, published at source precision —
  // a vague location defeats the memorial (standard §3).
  // (memorial_site, violence_associated, enslaver_or_segregationist, perpetrator_associated)

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
  /** Entity kind; see {@link PrecisionReductionInput.kind}. */
  readonly kind?: string;
  /** @deprecated see {@link PrecisionReductionInput.occupiedPrivateResidence}. */
  readonly occupiedPrivateResidence?: boolean;
  /** @deprecated see {@link PrecisionReductionInput.neededForPublic}. */
  readonly neededForPublic?: boolean;
};

export type PublicLocation = {
  readonly precision: PublicPrecisionTier;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly reductionReason?: PrecisionReductionReason;
};

function coarsenCoordinate(value: number, precision: PublicPrecisionTier): number | undefined {
  const decimals = COORDINATE_DECIMALS[precision];
  if (decimals === undefined) {
    return undefined;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Produce a public-safe location, or `undefined` when nothing may be shown.
 * Prohibited-level and sensitivity-reduced labels/coordinates are stripped or coarsened to
 * match the reduced precision (protects maps). A `site`/`address` tier label is allowed to be
 * a street address per the standard — it is the finest published tier, not an internal-only one
 * — so `containsProtectedText` is not applied to it; it stays scrubbing for free-text logs only.
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
    ...(location.kind === undefined ? {} : { kind: location.kind }),
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
    precision: PublicPrecisionTier;
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

  // Keep labels that were not reduced by a sensitivity rule. A site/address tier label is
  // allowed to carry a street address (the finest published tier); every coarser tier still
  // must not carry address-shaped text that outruns its own precision.
  const labelAllowedAtTier = precision === 'site' || precision === 'address';
  if (
    !reduction.reduced &&
    location.label &&
    (labelAllowedAtTier || !containsProtectedText(location.label))
  ) {
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
