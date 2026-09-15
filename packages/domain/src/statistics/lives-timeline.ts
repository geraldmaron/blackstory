/**
 * Builds the per-region bundle behind /lives/[region]: for every decade 1870–2020, class shares
 * and conditions for all three groups, the rules in force that applied to that place, and the
 * decade's narrative frame. Pure: loaders pass rows in, surfaces render what comes out.
 *
 * Guarantees, each covered by tests:
 * - Every group is always present; a missing value is a cell with a state, never an omission.
 * - Suppressed and unmeasured cells carry their reason and no estimate.
 * - The 1890 gap and every measurement-regime boundary are flagged.
 * - No change between decades is computed across a regime boundary.
 * - Rules resolve over the region, its ancestors and its member counties, by in-force overlap.
 *
 * Method: docs/methodology/lives-across-decades.md. Copy: juxtaposition-not-causation.md.
 */
import { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';
import {
  LIVES_CLASS_BUCKETS,
  LIVES_CLASS_SHARE_METRIC,
  LIVES_CONDITION_METRICS,
  LIVES_TIER_KEYS,
  livesMetricId,
  livesMetricLabel,
  type LivesClassBucket,
  type LivesMetricDefinition,
  type LivesMetricKey,
  type LivesMetricUnit,
  type LivesTierKey,
} from './lives-metrics.js';
import {
  LIVES_DECADES,
  LIVES_REGIME_DESCRIPTIONS,
  crossesLivesRegimeBoundary,
  livesHispanicOriginImputed,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
  type LivesDecade,
  type LivesMeasurementRegime,
  type LivesRegimeDescription,
} from './lives-regimes.js';
import {
  LIVES_GROUP_SLICES,
  normalizeRaceEthnicitySlice,
  type LivesGroupSlice,
} from './race-ethnicity-slices.js';

export type LivesCellState =
  'published' | 'wide_margin' | 'suppressed' | 'not_measured' | 'pending';

export type LivesSourceRef = {
  readonly label: string;
  readonly url: string;
};

export type LivesCell = {
  readonly state: LivesCellState;
  readonly estimate?: number;
  readonly marginOfError?: number;
  readonly unweightedN?: number;
  readonly reason?: string;
  readonly source?: LivesSourceRef;
};

export type LivesJurisdictionInput = {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
};

export type LivesRegionDecadeDefinitionInput = {
  readonly regionId: string;
  readonly decade: number;
  readonly referencePeriod: string;
  readonly boundaryVersion: string;
  readonly measurementRegime: LivesMeasurementRegime;
  readonly comparabilityNote: string;
  readonly memberCountyFips: readonly string[];
  /** Keyed `${metricId}|${slice}`. Only non-published states are recorded here. */
  readonly coverage: Readonly<
    Record<string, { readonly state: 'suppressed' | 'not_measured'; readonly reason: string }>
  >;
};

export type LivesObservationInput = {
  readonly metricId: string;
  readonly boundaryVersion: string;
  readonly raceEthnicitySlice: string | null;
  readonly estimate: number;
  readonly marginOfError?: number | null;
  readonly source: string;
  readonly sourceUrl: string;
  readonly metadata?: {
    readonly unweightedN?: number;
    readonly cellState?: 'published' | 'wide_margin';
  } | null;
};

export type LivesApplicabilityInput = {
  readonly id: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly entityHref: string | null;
  readonly jurisdictionId: string;
  readonly scopeLevel: 'federal' | 'state' | 'local';
  readonly inForceFromYear: number;
  readonly inForceToYear: number | null;
  readonly groupsNamed: readonly string[];
  readonly appliesToSlices: readonly (LivesGroupSlice | 'all')[];
  readonly lifeDomains: readonly string[];
  readonly textPosture: 'exclusionary' | 'protective' | 'facially_neutral';
  readonly disputed: boolean;
  readonly summary: string | null;
};

export type LivesFrameInput = {
  readonly decade: number;
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

export type LivesRule = {
  readonly id: string;
  readonly entityId: string;
  readonly name: string;
  readonly href: string | null;
  readonly scopeLevel: 'federal' | 'state' | 'local';
  readonly inForceFromYear: number;
  readonly inForceToYear: number | null;
  readonly appliesTo: readonly LivesGroupSlice[];
  readonly groupsNamed: readonly string[];
  readonly lifeDomains: readonly string[];
  readonly textPosture: 'exclusionary' | 'protective' | 'facially_neutral';
  readonly disputed: boolean;
  readonly summary: string | null;
};

export type LivesConditionBundle = {
  readonly key: LivesMetricKey;
  readonly label: string;
  readonly unit: LivesMetricUnit;
  readonly kind: 'share' | 'level';
  readonly cells: Readonly<Record<LivesGroupSlice, Readonly<Record<LivesTierKey, LivesCell>>>>;
};

/**
 * How the decade relates to the one before it: same measure, a method note on the same income
 * footing, a different measure altogether, or the 1890 gap.
 */
export type LivesBoundaryKind = 'none' | 'method_note' | 'different_measure' | 'gap';

export type LivesDecadeBundle = {
  readonly decade: LivesDecade;
  readonly label: string;
  readonly regime: LivesMeasurementRegime;
  readonly regimeDescription: LivesRegimeDescription;
  readonly boundaryFromPrevious: LivesBoundaryKind;
  readonly hispanicOriginImputed: boolean;
  readonly referencePeriod: string | null;
  readonly comparabilityNote: string | null;
  readonly classLabel: string;
  readonly classShares: Readonly<
    Record<LivesGroupSlice, Readonly<Record<LivesClassBucket, LivesCell>>>
  >;
  readonly conditions: readonly LivesConditionBundle[];
  readonly rulesInForce: readonly LivesRule[];
  readonly frame: { readonly heading: string; readonly paragraphs: readonly string[] } | null;
};

export type LivesRegionBundle = {
  readonly regionId: string;
  readonly regionName: string;
  readonly decades: readonly LivesDecadeBundle[];
  readonly disclaimer: string;
};

export type BuildLivesRegionBundleInput = {
  readonly region: LivesJurisdictionInput;
  readonly jurisdictions: readonly LivesJurisdictionInput[];
  readonly definitions: readonly LivesRegionDecadeDefinitionInput[];
  readonly observations: readonly LivesObservationInput[];
  readonly applicability: readonly LivesApplicabilityInput[];
  readonly frames: readonly LivesFrameInput[];
};

const SCOPE_ORDER = { federal: 0, state: 1, local: 2 } as const;

export function buildLivesRegionBundle(input: BuildLivesRegionBundleInput): LivesRegionBundle {
  const definitionsByDecade = new Map<number, LivesRegionDecadeDefinitionInput>();
  for (const definition of input.definitions) {
    if (definition.regionId !== input.region.id) continue;
    const expected = livesRegimeForDecadeOrThrow(definition.decade);
    if (definition.measurementRegime !== expected) {
      throw new Error(
        `${definition.regionId} ${definition.decade}s is stored as ${definition.measurementRegime}, but the method binds ${expected}`,
      );
    }
    definitionsByDecade.set(definition.decade, definition);
  }

  const observationIndex = new Map<string, LivesObservationInput>();
  for (const observation of input.observations) {
    const slice = normalizeRaceEthnicitySlice(observation.raceEthnicitySlice);
    if (slice === null) continue;
    observationIndex.set(
      observationKey(observation.metricId, observation.boundaryVersion, slice),
      observation,
    );
  }

  const ancestorIds = ancestorsOf(input.region.id, input.jurisdictions);
  const framesByDecade = new Map(input.frames.map((frame) => [frame.decade, frame]));

  const decades = LIVES_DECADES.map((decade, index): LivesDecadeBundle => {
    const regime = livesRegimeForDecade(decade);
    const definition = definitionsByDecade.get(decade) ?? null;
    const previous = index > 0 ? LIVES_DECADES[index - 1]! : null;
    const readCell = (
      metric: LivesMetricDefinition,
      bucket: LivesTierKey | LivesClassBucket,
      slice: LivesGroupSlice,
    ) => resolveCell({ metric, bucket, slice, decade, regime, definition, observationIndex });

    const classShares = mapGroups((slice) =>
      mapKeys(LIVES_CLASS_BUCKETS, (bucket) =>
        bucket === 'unclassified' && regime !== 'occupational_strata'
          ? notMeasured('Income tiers place every household, so none are unclassified.')
          : readCell(LIVES_CLASS_SHARE_METRIC, bucket, slice),
      ),
    );

    const conditions = LIVES_CONDITION_METRICS.map((metric): LivesConditionBundle => ({
      key: metric.key,
      label: livesMetricLabel(metric.key, regime),
      unit: metric.unit,
      kind: metric.kind,
      cells: mapGroups((slice) =>
        mapKeys(LIVES_TIER_KEYS, (tier) => readCell(metric, tier, slice)),
      ),
    }));

    const memberCountyIds = (definition?.memberCountyFips ?? []).map((fips) => `county:${fips}`);
    const applicableJurisdictions = new Set([...ancestorIds, ...memberCountyIds]);
    const rulesInForce = input.applicability
      .filter((row) => applicableJurisdictions.has(row.jurisdictionId))
      .filter((row) => overlapsDecade(row.inForceFromYear, row.inForceToYear, decade))
      .map((row) => toRule(row))
      .filter((rule) => rule.appliesTo.length > 0)
      .sort(
        (a, b) =>
          SCOPE_ORDER[a.scopeLevel] - SCOPE_ORDER[b.scopeLevel] ||
          a.inForceFromYear - b.inForceFromYear ||
          a.name.localeCompare(b.name),
      );

    const frame = framesByDecade.get(decade);

    return {
      decade,
      label: `${decade}s`,
      regime,
      regimeDescription: LIVES_REGIME_DESCRIPTIONS[regime],
      boundaryFromPrevious: previous === null ? 'none' : boundaryKind(previous, decade),
      hispanicOriginImputed: livesHispanicOriginImputed(decade),
      referencePeriod: definition?.referencePeriod ?? null,
      comparabilityNote: definition?.comparabilityNote ?? null,
      classLabel: LIVES_REGIME_DESCRIPTIONS[regime].classLabel,
      classShares,
      conditions,
      rulesInForce,
      frame: frame ? { heading: frame.heading, paragraphs: frame.paragraphs } : null,
    };
  });

  return {
    regionId: input.region.id,
    regionName: input.region.name,
    decades,
    disclaimer: JUXTAPOSITION_DISCLAIMER,
  };
}

/**
 * The change in a published value between two decades, or null when the comparison would cross a
 * measurement boundary or either value is not published.
 */
export function livesComparableChange(
  earlier: { readonly decade: LivesDecade; readonly cell: LivesCell },
  later: { readonly decade: LivesDecade; readonly cell: LivesCell },
): number | null {
  if (crossesLivesRegimeBoundary(earlier.decade, later.decade)) return null;
  const usable = (cell: LivesCell) =>
    (cell.state === 'published' || cell.state === 'wide_margin') && cell.estimate !== undefined;
  if (!usable(earlier.cell) || !usable(later.cell)) return null;
  return later.cell.estimate! - earlier.cell.estimate!;
}

function livesRegimeForDecadeOrThrow(decade: number): LivesMeasurementRegime {
  if (!(LIVES_DECADES as readonly number[]).includes(decade)) {
    throw new Error(`${decade} is not a Lives decade`);
  }
  return livesRegimeForDecade(decade as LivesDecade);
}

function boundaryKind(previous: LivesDecade, current: LivesDecade): LivesBoundaryKind {
  const a = livesRegimeForDecade(previous);
  const b = livesRegimeForDecade(current);
  if (a === 'no_microdata' || b === 'no_microdata') return 'gap';
  if (a === b) return 'none';
  return livesRegimesShareIncomeFooting(a, b) ? 'method_note' : 'different_measure';
}

function resolveCell(args: {
  readonly metric: LivesMetricDefinition;
  readonly bucket: LivesTierKey | LivesClassBucket;
  readonly slice: LivesGroupSlice;
  readonly decade: LivesDecade;
  readonly regime: LivesMeasurementRegime;
  readonly definition: LivesRegionDecadeDefinitionInput | null;
  readonly observationIndex: ReadonlyMap<string, LivesObservationInput>;
}): LivesCell {
  if (args.regime === 'no_microdata') {
    return notMeasured(LIVES_REGIME_DESCRIPTIONS.no_microdata.readerNote);
  }
  if (!args.metric.measuredIn(args.decade)) {
    return notMeasured(`The census did not record this in the ${args.decade}s.`);
  }
  if (args.definition === null) {
    return { state: 'pending', reason: 'Not yet tabulated for this region and decade.' };
  }
  const metricId = livesMetricId(args.metric, args.bucket);
  const observation = args.observationIndex.get(
    observationKey(metricId, args.definition.boundaryVersion, args.slice),
  );
  if (observation) {
    return {
      state: observation.metadata?.cellState ?? 'published',
      estimate: observation.estimate,
      ...(observation.marginOfError == null ? {} : { marginOfError: observation.marginOfError }),
      ...(observation.metadata?.unweightedN === undefined
        ? {}
        : { unweightedN: observation.metadata.unweightedN }),
      source: { label: observation.source, url: observation.sourceUrl },
    };
  }
  const recorded = args.definition.coverage[`${metricId}|${args.slice}`];
  if (recorded) return { state: recorded.state, reason: recorded.reason };
  return { state: 'pending', reason: 'Not yet tabulated for this region and decade.' };
}

function notMeasured(reason: string): LivesCell {
  return { state: 'not_measured', reason };
}

function observationKey(metricId: string, boundaryVersion: string, slice: string): string {
  return `${metricId}|${boundaryVersion}|${slice}`;
}

function ancestorsOf(id: string, jurisdictions: readonly LivesJurisdictionInput[]): Set<string> {
  const byId = new Map(jurisdictions.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current: string | null = id;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return seen;
}

function overlapsDecade(fromYear: number, toYear: number | null, decade: LivesDecade): boolean {
  return fromYear <= decade + 9 && (toYear === null || toYear >= decade);
}

function toRule(row: LivesApplicabilityInput): LivesRule {
  const appliesTo = row.appliesToSlices.includes('all')
    ? [...LIVES_GROUP_SLICES]
    : LIVES_GROUP_SLICES.filter((slice) => row.appliesToSlices.includes(slice));
  return {
    id: row.id,
    entityId: row.entityId,
    name: row.entityName,
    href: row.entityHref,
    scopeLevel: row.scopeLevel,
    inForceFromYear: row.inForceFromYear,
    inForceToYear: row.inForceToYear,
    appliesTo,
    groupsNamed: row.groupsNamed,
    lifeDomains: row.lifeDomains,
    textPosture: row.textPosture,
    disputed: row.disputed,
    summary: row.summary,
  };
}

function mapGroups<T>(build: (slice: LivesGroupSlice) => T): Readonly<Record<LivesGroupSlice, T>> {
  return {
    black_nh: build('black_nh'),
    white_nh: build('white_nh'),
    hispanic: build('hispanic'),
  };
}

function mapKeys<K extends string, T>(
  keys: readonly K[],
  build: (key: K) => T,
): Readonly<Record<K, T>> {
  const out = {} as Record<K, T>;
  for (const key of keys) out[key] = build(key);
  return out;
}
