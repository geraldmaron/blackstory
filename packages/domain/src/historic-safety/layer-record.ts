/**
 * OWN time-scoped, evidence-backed place-condition layer records: sundown-town
 * designations (Tougaloo College Historical Database taxonomy, preserved verbatim as
 * possible/probable/surely a claim confidence, never flattened to a boolean) and redlining
 * grades (HOLC A-D, a distinct vocabulary and a distinct designation record type see ).
 *
 * SCOPE GUARDRAIL (mirrors../entity-status.ts's own guardrail comment verbatim in spirit): these
 * records are NOT `StatusHistoryEntry` and NEVER live on `CanonicalEntity.statusHistory`
 * (lane). They follow the same {validFrom, validTo, datePrecision, basisClaimIds}
 * time-scoping *pattern* established, reusing own `statusAsOf`/`currentStatus`
 * point-in-time algorithms by composition (mapping this module's designation-specific field onto
 * that generic algorithm's `status` slot) rather than duplicating the date-window logic but the
 * storage location, record identity, and vocabulary are entirely own.
 *
 * GEOMETRY BINDING: an area condition binds to jurisdiction/place geometry as
 * an AREA over a time range a Polygon or BBox, never a Point marker and is rendered only at
 * the precision level its source documentation actually supports. A county-level-only source
 * renders as a county polygon; it is never interpolated down to shade or point-mark individual
 * towns within it as if independently documented. `assertAreaConditionRenderPrecisionValid`
 * enforces that fail-closed.
 */
import { currentStatus, statusAsOf, type StatusHistoryEntry } from '../entity-status.js';
import type { DatePrecision } from '../era.js';
import type { GeoGeometry } from '../geography/location.js';
import { isCoarserGeoPrecisionTier, type GeoPrecisionTier } from '../geography/precision.js';

// ---------------------------------------------------------------------------
// Vocabularies kept distinct per stress-test correction
// ---------------------------------------------------------------------------

/** Tougaloo College Historical Database of Sundown Towns taxonomy, preserved verbatim. */
export const SUNDOWN_TOWN_CONFIDENCE_LEVELS = ['possible', 'probable', 'surely'] as const;
export type SundownTownConfidence = (typeof SUNDOWN_TOWN_CONFIDENCE_LEVELS)[number];

export function isSundownTownConfidence(value: string): value is SundownTownConfidence {
  return (SUNDOWN_TOWN_CONFIDENCE_LEVELS as readonly string[]).includes(value);
}

/** HOLC Residential Security Map grades (Mapping Inequality) A-D, distinct from the taxonomy above. */
export const HOLC_GRADES = ['A', 'B', 'C', 'D'] as const;
export type HolcGrade = (typeof HOLC_GRADES)[number];

export function isHolcGrade(value: string): value is HolcGrade {
  return (HOLC_GRADES as readonly string[]).includes(value);
}

export const HOLC_GRADE_LABELS: Readonly<Record<HolcGrade, string>> = {
  A: 'Grade A ("Best")',
  B: 'Grade B ("Still Desirable")',
  C: 'Grade C ("Definitely Declining")',
  D: 'Grade D ("Hazardous")',
};

/** Digitized racially restrictive covenant projects free-text project type, no fixed vocabulary
 * exists across the digitization projects this layer draws on. */
export const PLACE_CONDITION_DESIGNATION_KINDS = [
  'sundown_town',
  'redlining_grade',
  'restrictive_covenant',
] as const;
export type PlaceConditionDesignationKind = (typeof PLACE_CONDITION_DESIGNATION_KINDS)[number];

// ---------------------------------------------------------------------------
// Area-condition geometry binding 
// ---------------------------------------------------------------------------

/** An area-only geometry a sundown town or redlining grade covers a place over a time range,
 * never a point marker. */
export type AreaGeometry = Extract<GeoGeometry, { readonly type: 'Polygon' | 'BBox' }>;

export type AreaConditionGeometry = {
  readonly shape: AreaGeometry;
  /** The FINEST tier the underlying source documentation actually supports never invented. */
  readonly documentedPrecisionTier: GeoPrecisionTier;
  readonly jurisdictionId?: string;
};

export function assertAreaConditionGeometryValid(geometry: AreaConditionGeometry): void {
  if (geometry.shape.type !== 'Polygon' && geometry.shape.type !== 'BBox') {
    throw new Error(
      'AreaConditionGeometry.shape must be a Polygon or BBox — an area condition (sundown town, ' +
        'redlining grade) renders as an area over a time range, never a point marker (BB-082/BB-091 AC9).',
    );
  }
}

/**
 * Fails closed when a requested render tier is FINER than the documented tier: a
 * county-level-only source must render as a county polygon, never interpolated down to a finer
 * tier that implies independent town-level documentation it does not have.
 */
export function assertAreaConditionRenderPrecisionValid(input: {
  readonly documentedPrecisionTier: GeoPrecisionTier;
  readonly renderPrecisionTier: GeoPrecisionTier;
}): void {
  if (isCoarserGeoPrecisionTier(input.documentedPrecisionTier, input.renderPrecisionTier)) {
    throw new Error(
      `Area-condition render precision "${input.renderPrecisionTier}" is finer than the ` +
        `documented precision "${input.documentedPrecisionTier}" — rendering must never infer a ` +
        'finer geographic precision than the source documentation supports (BB-082/BB-091 AC11).',
    );
  }
}

// ---------------------------------------------------------------------------
// Time-scoped designation records own record type, not statusHistory
// ---------------------------------------------------------------------------

type BaseDesignationRecord = {
  readonly id: string;
  readonly placeEntityId: string;
  readonly validFrom?: string;
  /** Omitted or null means open-ended (still current as of now) same idiom as StatusHistoryEntry. */
  readonly validTo?: string | null;
  readonly datePrecision: DatePrecision;
  readonly basisClaimIds: readonly string[];
  readonly areaGeometry: AreaConditionGeometry;
};

export type SundownTownDesignationRecord = BaseDesignationRecord & {
  readonly designation: 'sundown_town';
  readonly confidence: SundownTownConfidence;
};

export type RedliningGradeDesignationRecord = BaseDesignationRecord & {
  readonly designation: 'redlining_grade';
  readonly grade: HolcGrade;
};

export type RestrictiveCovenantDesignationRecord = BaseDesignationRecord & {
  readonly designation: 'restrictive_covenant';
  /** Free-text digitization-project vocabulary (e.g. "Mapping Prejudice"); no fixed enum exists
   * across projects. */
  readonly covenantProjectLabel: string;
};

export type PlaceConditionDesignationRecord =
  | SundownTownDesignationRecord
  | RedliningGradeDesignationRecord
  | RestrictiveCovenantDesignationRecord;

function assertBaseDesignationRecordValid(record: BaseDesignationRecord): void {
  if (!record.id.trim()) throw new Error('Designation record id is required');
  if (!record.placeEntityId.trim()) throw new Error('Designation record placeEntityId is required');
  if (record.basisClaimIds.length === 0) {
    throw new Error(
      'Designation records require >=1 basisClaimIds — a place-condition designation is always a claim, never an unsourced label.',
    );
  }
  assertAreaConditionGeometryValid(record.areaGeometry);
}

export function assertSundownTownDesignationValid(record: SundownTownDesignationRecord): void {
  assertBaseDesignationRecordValid(record);
  if (!isSundownTownConfidence(record.confidence)) {
    throw new Error(`Unknown sundown-town confidence: ${record.confidence}`);
  }
}

export function assertRedliningGradeDesignationValid(record: RedliningGradeDesignationRecord): void {
  assertBaseDesignationRecordValid(record);
  if (!isHolcGrade(record.grade)) {
    throw new Error(`Unknown HOLC grade: ${record.grade}`);
  }
}

export function assertRestrictiveCovenantDesignationValid(
  record: RestrictiveCovenantDesignationRecord,
): void {
  assertBaseDesignationRecordValid(record);
  if (!record.covenantProjectLabel.trim()) {
    throw new Error('RestrictiveCovenantDesignationRecord.covenantProjectLabel is required');
  }
}

export function assertPlaceConditionDesignationValid(record: PlaceConditionDesignationRecord): void {
  if (record.designation === 'sundown_town') {
    assertSundownTownDesignationValid(record);
    return;
  }
  if (record.designation === 'redlining_grade') {
    assertRedliningGradeDesignationValid(record);
    return;
  }
  assertRestrictiveCovenantDesignationValid(record);
}

// ---------------------------------------------------------------------------
// Point-in-time queries composes proven statusAsOf/currentStatus algorithm
// ---------------------------------------------------------------------------

function toStatusHistoryEntry<S extends string>(
  record: Pick<BaseDesignationRecord, 'validFrom' | 'validTo' | 'datePrecision' | 'basisClaimIds'>,
  status: S,
): StatusHistoryEntry<S> {
  return {
    status,
    ...(record.validFrom !== undefined ? { validFrom: record.validFrom } : {}),
    ...(record.validTo !== undefined ? { validTo: record.validTo } : {}),
    datePrecision: record.datePrecision,
    basisClaimIds: record.basisClaimIds,
  };
}

/** Answers "what was this place's sundown-town confidence in decade D" for any decade. */
export function sundownTownConfidenceAsOf(
  records: readonly SundownTownDesignationRecord[],
  asOf: string,
): SundownTownConfidence | undefined {
  const entries = records.map((record) => toStatusHistoryEntry(record, record.confidence));
  return statusAsOf(entries, asOf);
}

/** Current (open-ended) sundown-town confidence, derived the same way derives current status. */
export function currentSundownTownConfidence(
  records: readonly SundownTownDesignationRecord[],
): SundownTownConfidence | undefined {
  const entries = records.map((record) => toStatusHistoryEntry(record, record.confidence));
  return currentStatus(entries);
}

/** Answers "what was this place's redlining grade in decade D" for any decade. */
export function redliningGradeAsOf(
  records: readonly RedliningGradeDesignationRecord[],
  asOf: string,
): HolcGrade | undefined {
  const entries = records.map((record) => toStatusHistoryEntry(record, record.grade));
  return statusAsOf(entries, asOf);
}

export function currentRedliningGrade(
  records: readonly RedliningGradeDesignationRecord[],
): HolcGrade | undefined {
  const entries = records.map((record) => toStatusHistoryEntry(record, record.grade));
  return currentStatus(entries);
}

// ---------------------------------------------------------------------------
// Storage boundary (Firestore adapter is a later, same shape convention as elsewhere)
// ---------------------------------------------------------------------------

export type PlaceConditionLayerStore = {
  get(id: string): PlaceConditionDesignationRecord | undefined;
  listForPlace(placeEntityId: string): readonly PlaceConditionDesignationRecord[];
  save(record: PlaceConditionDesignationRecord): void;
};

export function createInMemoryPlaceConditionLayerStore(
  seed: readonly PlaceConditionDesignationRecord[] = [],
): PlaceConditionLayerStore {
  const records = new Map<string, PlaceConditionDesignationRecord>(seed.map((r) => [r.id, r]));
  return {
    get(id: string) {
      return records.get(id);
    },
    listForPlace(placeEntityId: string) {
      return [...records.values()]
        .filter((r) => r.placeEntityId === placeEntityId)
        .sort((a, b) => (a.validFrom ?? '').localeCompare(b.validFrom ?? ''));
    },
    save(record: PlaceConditionDesignationRecord) {
      assertPlaceConditionDesignationValid(record);
      records.set(record.id, record);
    },
  };
}
