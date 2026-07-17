
/**
 * Public serialization choke point for Black Book.
 *
 * Every value that becomes public entity projections, search-index documents, and
 * exports must pass through this module. It reduces location precision, strips
 * residential/address fields, and fails closed (`assertPublicProjectionSafe`) if any
 * prohibited precision or protected value would otherwise reach a public surface.
 * Learning-index fields (required summary, topic tags, optional prose/photo) are
 * gated via `@black-book/domain` assertLearningIndexProjection.
 */
import type { LivingStatus, PublicEntityPrimaryImage, PublicRelatedEntry } from '@black-book/domain';
import {
  allowedPublicPrecisionLevels,
  assertLearningIndexProjection,
  hasPreferredTopicTags,
  prohibitedPublicPrecisionLevels,
  sanitizePrimaryImageForRelease,
} from '@black-book/domain';
import { evaluatePublicPrecision } from '@black-book/schemas';
import {
  createSensitiveDataRedactor,
  redactLocationForPublic,
  type InternalLocationInput,
  type PublicLocation,
} from './redaction.js';

export type PublicSerializableEntity = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly livingStatus?: LivingStatus;
};

export type PublicProjectionLocation = {
  readonly lat: number;
  readonly lng: number;
  readonly geohash: string;
  readonly precision?: string;
  readonly matchMethod?: string;
};

export type PublicEntityProjection = {
  readonly id: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly nameLower: string;
  readonly summary: string;
  readonly topicTags: readonly string[];
  readonly historicalContext?: string;
  readonly extendedNarrative?: string;
  readonly primaryImage?: PublicEntityPrimaryImage;
  readonly related?: readonly PublicRelatedEntry[];
  readonly location?: PublicProjectionLocation;
  readonly claimIds: readonly string[];
};

export type PublicSearchDocument = {
  readonly entityId: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly nameLower: string;
  readonly geohash?: string;
  readonly precision?: string;
};

/** Object keys that must never appear on a public payload (address components). */
const PROHIBITED_PUBLIC_FIELD_KEYS = new Set([
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
  'coordinates',
  'geometry',
]);

const COORDINATE_KEYS = new Set(['lat', 'latitude', 'lng', 'lon', 'longitude']);

const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)*\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|circle|cir|highway|hwy|parkway|pkwy|square|sq|trail|trl|apartment|apt|suite|ste|unit)\b\.?/i;

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Throw when a precision level may not appear on public surfaces for this living status. */
export function assertNoProhibitedPublicPrecision(
  precision: string,
  options: { livingStatus?: LivingStatus } = {},
): void {
  const result = evaluatePublicPrecision(
    precision,
    options.livingStatus === undefined ? {} : { livingStatus: options.livingStatus },
  );
  if (!result.allowed) {
    throw new Error(`Public precision not allowed: ${precision} (${result.reason ?? 'denied'})`);
  }
}


/**
 * Fail-closed structural audit of a payload bound for a public surface.
 * Rejects prohibited precision levels, address-component keys, address-shaped strings,
 * and un-coarsened (exact) coordinates. Firestore public converters call this.
 */
export function assertPublicProjectionSafe(payload: unknown, path = 'public'): void {
  if (payload === null || typeof payload !== 'object') {
    if (typeof payload === 'string' && STREET_ADDRESS_PATTERN.test(payload)) {
      throw new Error(`Public payload contains an address-shaped value at ${path}`);
    }
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertPublicProjectionSafe(item, `${path}[${index}]`));
    return;
  }

  const record = payload as Record<string, unknown>;
  const prohibited = new Set(prohibitedPublicPrecisionLevels());
  const allowed = new Set(allowedPublicPrecisionLevels());

  for (const [key, value] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();

    if (PROHIBITED_PUBLIC_FIELD_KEYS.has(lowerKey) && value !== undefined && value !== null) {
      throw new Error(`Public payload contains prohibited field "${key}" at ${path}`);
    }

    if (lowerKey === 'precision' && typeof value === 'string') {
      if (prohibited.has(value) || !allowed.has(value)) {
        throw new Error(`Public payload has prohibited precision "${value}" at ${path}`);
      }
    }

    if (COORDINATE_KEYS.has(lowerKey) && typeof value === 'number' && decimalPlaces(value) > 4) {
      throw new Error(`Public payload has exact coordinate "${key}" at ${path}`);
    }

    if (typeof value === 'string' && STREET_ADDRESS_PATTERN.test(value)) {
      throw new Error(`Public payload contains an address-shaped value at ${path}.${key}`);
    }

    assertPublicProjectionSafe(value, `${path}.${key}`);
  }
}

function toProjectionLocation(
  location: PublicLocation | undefined,
): PublicProjectionLocation | undefined {
  if (
    location === undefined ||
    location.lat === undefined ||
    location.lng === undefined ||
    location.geohash === undefined
  ) {
    return undefined;
  }
  const result: {
    lat: number;
    lng: number;
    geohash: string;
    precision?: string;
    matchMethod?: string;
  } = {
    lat: location.lat,
    lng: location.lng,
    geohash: location.geohash,
    precision: location.precision,
  };
  if (location.matchMethod) {
    result.matchMethod = location.matchMethod;
  }
  return result;
}

export type PublicEntityProjectionOptions = {
  readonly releaseId: string;
  /** Required learning-index summary (120–400 chars). */
  readonly summary: string;
  readonly claimIds?: readonly string[];
  readonly location?: InternalLocationInput;
  readonly topicTags?: readonly string[];
  readonly historicalContext?: string;
  readonly extendedNarrative?: string;
  readonly primaryImage?: PublicEntityPrimaryImage;
  readonly related?: readonly PublicRelatedEntry[];
};


/**
 * Build a public entity projection from a canonical entity and an optional internal
 * location. The location is reduced through {@link redactLocationForPublic} using the
 * entity's living status, and the finished projection is verified fail-closed.
 * Learning-index summary/image gates run before the structural safety audit.
 */
export function toPublicEntityProjection(
  entity: PublicSerializableEntity,
  options: PublicEntityProjectionOptions,
): PublicEntityProjection {
  const primaryImage = sanitizePrimaryImageForRelease(options.primaryImage);
  assertLearningIndexProjection({
    summary: options.summary,
    ...(options.topicTags !== undefined ? { topicTags: options.topicTags } : {}),
    ...(options.historicalContext !== undefined
      ? { historicalContext: options.historicalContext }
      : {}),
    ...(options.extendedNarrative !== undefined
      ? { extendedNarrative: options.extendedNarrative }
      : {}),
    ...(primaryImage !== undefined ? { primaryImage } : {}),
    ...(options.related !== undefined ? { related: options.related } : {}),
  });

  if (!hasPreferredTopicTags(options.topicTags)) {
    // Soft preference: empty tags are allowed but should be rare in curated releases.
    // Hard gate remains summary (+ image rights when present).
  }

  const publicLocation = options.location
    ? redactLocationForPublic({
        ...options.location,
        ...(options.location.livingStatus === undefined
          ? { livingStatus: entity.livingStatus }
          : {}),
      })
    : undefined;

  const projection: {
    id: string;
    releaseId: string;
    kind: string;
    displayName: string;
    nameLower: string;
    summary: string;
    topicTags: readonly string[];
    historicalContext?: string;
    extendedNarrative?: string;
    primaryImage?: PublicEntityPrimaryImage;
    related?: readonly PublicRelatedEntry[];
    location?: PublicProjectionLocation;
    claimIds: readonly string[];
  } = {
    id: entity.id,
    releaseId: options.releaseId,
    kind: entity.kind,
    displayName: entity.displayName,
    nameLower: entity.displayName.toLowerCase(),
    summary: options.summary.trim(),
    topicTags: options.topicTags ?? [],
    claimIds: options.claimIds ?? [],
  };

  if (options.historicalContext !== undefined) {
    projection.historicalContext = options.historicalContext;
  }
  if (options.extendedNarrative !== undefined) {
    projection.extendedNarrative = options.extendedNarrative;
  }
  if (primaryImage !== undefined) {
    projection.primaryImage = primaryImage;
  }
  if (options.related !== undefined) {
    projection.related = options.related;
  }
  const location = toProjectionLocation(publicLocation);
  if (location !== undefined) {
    projection.location = location;
  }

  assertPublicProjectionSafe(projection);
  return projection;
}


/**
 * Build a search-index document. Search docs deliberately carry no coordinates or
 * address fields only a name token and a coarse geohash so queries can never
 * match a prohibited address field.
 */
export function toPublicSearchDocument(
  entity: PublicSerializableEntity,
  options: { releaseId: string; location?: InternalLocationInput },
): PublicSearchDocument {
  const publicLocation = options.location
    ? redactLocationForPublic({
        ...options.location,
        ...(options.location.livingStatus === undefined
          ? { livingStatus: entity.livingStatus }
          : {}),
      })
    : undefined;

  const doc: {
    entityId: string;
    releaseId: string;
    kind: string;
    nameLower: string;
    geohash?: string;
    precision?: string;
  } = {
    entityId: entity.id,
    releaseId: options.releaseId,
    kind: entity.kind,
    nameLower: entity.displayName.toLowerCase(),
  };

  if (publicLocation?.geohash) {
    doc.geohash = publicLocation.geohash;
    doc.precision = publicLocation.precision;
  }

  assertPublicProjectionSafe(doc);
  return doc;
}


/**
 * Redact an arbitrary record for public export. Deep-strips address components and
 * address-shaped strings, then verifies the result is publication-safe.
 */
export function redactForPublicExport<T>(record: T): T {
  const redactor = createSensitiveDataRedactor({
    dropKeys: true,
    extraKeys: [...PROHIBITED_PUBLIC_FIELD_KEYS],
  });
  const redacted = redactor(record) as T;
  assertPublicProjectionSafe(redacted);
  return redacted;
}
