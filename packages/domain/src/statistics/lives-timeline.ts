/**
 * Builds the bundle behind /lives/[area]: for every decade 1870–2020, what the count could see, class
 * shares and conditions for all three lenses, the rules in force, and the decade's frame. Pure: the
 * snapshot build passes rows in, surfaces render what comes out.
 *
 * Figures arrive at state and national level as published. A region's figure is derived here by summing
 * its member states; the national baseline uses a published national figure when one exists. Each
 * figure reaches a lens through the definition its era published, and carries that definition's label.
 *
 * Guarantees, each covered by tests:
 * - Every lens is present in every decade; a missing value is a cell with a state and a reason.
 * - Hispanic figures appear only where the census counted Hispanic origin or a named proxy.
 * - A region figure published for too little of its population, or on too small a base, is withheld.
 * - No change between decades is computed across a measurement boundary.
 * - Rules resolve to federal law and the area's member states, each labeled with its jurisdiction.
 *
 * Method: docs/methodology/lives-across-decades.md. Copy: juxtaposition-not-causation.md.
 */
import { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';
import {
  aggregateDistribution,
  aggregateRate,
  coverageShare,
  estimateBandShares,
  estimateMedian,
  sumBrackets,
  type IncomeBracket,
  type StateCount,
} from './lives-aggregate.js';
import {
  LIVES_CLASS_BUCKETS,
  LIVES_CONDITIONS,
  LIVES_SERIES,
  livesConditionLabel,
  livesConditionPublishedIn,
  livesDecadeForReferencePeriod,
  parseIncomeBracketSeriesId,
  workClassSeriesId,
  type LivesClassBucket,
  type LivesConditionKey,
  type LivesConditionDefinition,
  type LivesConditionUnit,
} from './lives-metrics.js';
import {
  LIVES_DECADES,
  LIVES_REGIME_DESCRIPTIONS,
  crossesLivesRegimeBoundary,
  livesHispanicCounting,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
  type LivesDecade,
  type LivesHispanicCounting,
  type LivesMeasurementRegime,
  type LivesRegimeDescription,
} from './lives-regimes.js';
import { livesStateJurisdictionId, type LivesAreaConfig } from './lives-regions.js';
import {
  LIVES_LENSES,
  RACE_ETHNICITY_DEFINITION_LABELS,
  lensForDefinition,
  normalizeRaceEthnicitySlice,
  preferredDefinition,
  type CanonicalRaceEthnicitySlice,
  type LivesLens,
} from './race-ethnicity-slices.js';
import type { LivesWorldBeat, LivesWorldBeatInput } from './lives-world.js';

export type LivesCellState =
  'published' | 'wide_margin' | 'suppressed' | 'not_measured' | 'pending';

export type LivesSourceRef = {
  readonly label: string;
  readonly url: string;
  /** Wayback availability pointer when a lookup already found a capture. Never invent. */
  readonly archiveUrl?: string;
};

export type LivesCell = {
  readonly state: LivesCellState;
  /** Percentage, 0–100. */
  readonly estimate?: number;
  readonly marginOfError?: number;
  readonly reason?: string;
  readonly definitionLabel?: string;
  /** Share of the area's group population the figure covers, 0–100, when below 100. */
  readonly coveragePct?: number;
  /** Jurisdictions a region-limited definition (Spanish surname, Puerto Rican birth) was counted in. */
  readonly countedIn?: readonly string[];
  /** True when the figure was summed or estimated rather than printed. */
  readonly derived?: boolean;
  /** The count note that explains a missing or limited figure. */
  readonly noteId?: string;
  readonly sources?: readonly LivesSourceRef[];
  /** `reference.statistical_observations` ids behind a published figure, for derived measures. */
  readonly observationIds?: readonly string[];
};

export type LivesJurisdictionInput = {
  readonly id: string;
  readonly name: string;
};

export type LivesObservationInput = {
  /** `reference.statistical_observations.id`. Absent on inputs built before gaps were derived. */
  readonly id?: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly referencePeriod: string;
  readonly raceEthnicitySlice: string | null;
  readonly estimate: number;
  readonly numerator?: number | null;
  readonly denominator?: number | null;
  readonly source: string;
  readonly sourceUrl: string;
  /**
   * For an agency value series: the population the agency says the figure describes ("nonwhite",
   * "Black", "non-Hispanic single-race Black"), and, for births, whose race classifies the birth.
   */
  readonly populationLabel?: string | null;
  readonly populationBasis?: string | null;
  readonly metadata?: {
    /** ACS 90% margins on the counts, when published. */
    readonly numeratorMoe?: number;
    readonly denominatorMoe?: number;
  } | null;
};

export type LivesCoverageInput = {
  readonly decade: number;
  readonly key: LivesConditionKey | 'class_share';
  readonly lens: LivesLens | 'all';
  readonly state: 'not_measured' | 'suppressed';
  readonly reason: string;
};

export type LivesCountNoteInput = {
  readonly id: string;
  readonly decade: number;
  readonly appliesTo: readonly (LivesLens | 'all')[];
  /** Areas the note is limited to; empty means every area. */
  readonly areaIds: readonly string[];
  readonly heading: string;
  readonly body: string;
  readonly citations: readonly LivesSourceRef[];
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
  readonly appliesToSlices: readonly (LivesLens | 'all')[];
  readonly lifeDomains: readonly string[];
  readonly textPosture: 'exclusionary' | 'protective' | 'facially_neutral';
  readonly disputed: boolean;
  /** What followed: the record's cited impact statement. Null when the record has none. */
  readonly summary: string | null;
  /** What it did: the record's own summary. Absent on inputs built before the field existed. */
  readonly description?: string | null;
};

export type LivesFrameInput = {
  readonly decade: number;
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

export type LivesCountNote = {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
  readonly appliesTo: readonly (LivesLens | 'all')[];
  readonly citations: readonly LivesSourceRef[];
};

export type LivesRule = {
  readonly id: string;
  readonly entityId: string;
  readonly name: string;
  readonly href: string | null;
  readonly scopeLevel: 'federal' | 'state' | 'local';
  /** "Federal", or the state's name. */
  readonly jurisdictionLabel: string;
  readonly inForceFromYear: number;
  readonly inForceToYear: number | null;
  readonly appliesTo: readonly LivesLens[];
  readonly groupsNamed: readonly string[];
  readonly lifeDomains: readonly string[];
  readonly textPosture: 'exclusionary' | 'protective' | 'facially_neutral';
  readonly disputed: boolean;
  /** What followed: the record's cited impact statement. Null when the record has none. */
  readonly summary: string | null;
  /**
   * What it did: the record's own summary. Optional so snapshots built before the field existed
   * still read; surfaces render nothing in its place rather than falling back to `summary`.
   */
  readonly description?: string | null;
};

/**
 * The distance between two groups' published rates, in percentage points. It is the "derived gap"
 * shape docs/methodology/juxtaposition-not-causation.md allows: plain arithmetic on published
 * figures, carrying its formula and the observations it was computed from. It is a difference and
 * claims no cause. It carries no timestamp of its own, so an unchanged figure still hashes the
 * same and the snapshot is not rewritten; the snapshot's `generatedAt` dates it.
 */
export type LivesConditionGap = {
  readonly methodId: 'lives-group-gap';
  readonly methodVersion: '1';
  readonly status: 'derived';
  readonly betweenLenses: readonly [LivesLens, LivesLens];
  /** Absolute difference, from the unrounded estimates. */
  readonly points: number;
  /** 90% margin on the difference, when both figures carry a survey margin. */
  readonly uncertainty?: number;
  readonly formula: string;
  readonly inputObservationIds: readonly string[];
  readonly assumptions: readonly string[];
  /** The unit `points` is in. Absent on gaps derived before units existed: percent. */
  readonly unit?: LivesConditionUnit;
};

export type LivesConditionBundle = {
  readonly key: LivesConditionKey;
  readonly label: string;
  readonly universe: string;
  readonly cells: Readonly<Record<LivesLens, LivesCell>>;
  /** Black against white, when both figures are published rates. Optional: older snapshots lack it. */
  readonly gap?: LivesConditionGap;
  /** Absent means percent, which is every condition a snapshot held before units existed. */
  readonly unit?: LivesConditionUnit;
};

/** True when the condition is each group's own rate of an outcome, so two groups can be compared. */
export function livesConditionIsGroupRate(key: LivesConditionKey): boolean {
  return key !== 'population_share';
}

/** Black against white only: the comparison every panel draws. Null unless both are published rates. */
const GAP_FORMULA: Readonly<Record<LivesConditionUnit, string>> = {
  percent:
    'The larger of the two published rates minus the smaller, in percentage points, before rounding. Each rate uses its own group’s denominator.',
  years: 'The larger of the two published figures minus the smaller, in years.',
  per_1000:
    'The larger of the two published rates minus the smaller, in deaths per 1,000 live births.',
};

export function deriveLivesConditionGap(
  cells: Readonly<Record<LivesLens, LivesCell>>,
  unit: LivesConditionUnit = 'percent',
): LivesConditionGap | null {
  const { black, white } = cells;
  // A figure for "everyone other than white, counted together" is not a Black figure, so the
  // distance from it to the white figure is not a Black and white gap.
  if (black.definitionLabel === RACE_ETHNICITY_DEFINITION_LABELS.nonwhite) return null;
  const usable = (cell: LivesCell): cell is LivesCell & { estimate: number } =>
    (cell.state === 'published' || cell.state === 'wide_margin') && cell.estimate !== undefined;
  if (!usable(black) || !usable(white)) return null;
  const points = Math.round(Math.abs(white.estimate - black.estimate) * 100) / 100;
  const uncertainty =
    black.marginOfError !== undefined && white.marginOfError !== undefined
      ? Math.round(Math.sqrt(black.marginOfError ** 2 + white.marginOfError ** 2) * 100) / 100
      : undefined;
  return {
    methodId: 'lives-group-gap',
    methodVersion: '1',
    status: 'derived',
    betweenLenses: ['black', 'white'],
    points,
    ...(uncertainty !== undefined ? { uncertainty } : {}),
    formula: GAP_FORMULA[unit],
    ...(unit === 'percent' ? {} : { unit }),
    inputObservationIds: [...(black.observationIds ?? []), ...(white.observationIds ?? [])],
    assumptions: [
      `Black: ${black.definitionLabel ?? 'definition not recorded'}`,
      `White: ${white.definitionLabel ?? 'definition not recorded'}`,
      'A difference between two published figures. It does not say why the figures differ.',
    ],
  };
}

/** How a decade relates to the one before it: same measure, a same-unit method change, or a new measure. */
export type LivesBoundaryKind = 'none' | 'method_note' | 'different_measure';

export type LivesDecadeBundle = {
  readonly decade: LivesDecade;
  readonly label: string;
  readonly regime: LivesMeasurementRegime;
  readonly regimeDescription: LivesRegimeDescription;
  readonly boundaryFromPrevious: LivesBoundaryKind;
  readonly hispanicCounting: LivesHispanicCounting;
  readonly classLabel: string;
  readonly countNotes: readonly LivesCountNote[];
  readonly classShares: Readonly<Record<LivesLens, Readonly<Record<LivesClassBucket, LivesCell>>>>;
  readonly conditions: readonly LivesConditionBundle[];
  readonly rulesInForce: readonly LivesRule[];
  readonly frame: { readonly heading: string; readonly paragraphs: readonly string[] } | null;
  readonly worldBeats: readonly LivesWorldBeat[];
};

export type LivesAreaBundle = {
  readonly areaId: string;
  readonly areaSlug: string;
  readonly areaName: string;
  readonly areaKind: 'nation' | 'region';
  readonly decades: readonly LivesDecadeBundle[];
  readonly disclaimer: string;
};

export type BuildLivesAreaBundleInput = {
  readonly area: LivesAreaConfig;
  readonly jurisdictions: readonly LivesJurisdictionInput[];
  readonly observations: readonly LivesObservationInput[];
  readonly coverage: readonly LivesCoverageInput[];
  readonly countNotes: readonly LivesCountNoteInput[];
  readonly applicability: readonly LivesApplicabilityInput[];
  readonly frames: readonly LivesFrameInput[];
  /** Authored world beats; entity hrefs resolved by the snapshot build when available. */
  readonly worldBeats?: readonly LivesWorldBeatInput[];
  /** Optional pre-resolved beats already scoped to this area (snapshot / tests). */
  readonly resolvedWorldBeats?: readonly {
    readonly decade: LivesDecade;
    readonly beat: LivesWorldBeat;
  }[];
};

/** A region figure on a smaller base than this many counted people or households is withheld. */
export const LIVES_MIN_BASE = 500;
/** A region figure covering less than this share of the area's group population is withheld. */
export const LIVES_MIN_COVERAGE = 0.8;
const Z_90 = 1.645;
const NATION_ID = 'nation:US';
const OWN_SCOPE_DEFINITIONS: readonly CanonicalRaceEthnicitySlice[] = [
  'spanish_surname',
  'puerto_rican',
  'mexican',
];
const SCOPE_ORDER = { federal: 0, state: 1, local: 2 } as const;

type IndexedRow = LivesObservationInput & {
  readonly definition: CanonicalRaceEthnicitySlice;
  readonly lens: LivesLens | null;
};

export function buildLivesAreaBundle(input: BuildLivesAreaBundleInput): LivesAreaBundle {
  const area = input.area;
  const names = new Map(input.jurisdictions.map((row) => [row.id, row.name]));
  const memberIds = area.memberStateFips.map(livesStateJurisdictionId);

  const byMetricDecade = new Map<string, IndexedRow[]>();
  for (const observation of input.observations) {
    const decade = livesDecadeForReferencePeriod(observation.referencePeriod);
    const definition = normalizeRaceEthnicitySlice(observation.raceEthnicitySlice);
    if (decade === null || definition === null) continue;
    const key = `${observation.metricId}|${decade}`;
    const rows = byMetricDecade.get(key) ?? [];
    rows.push({ ...observation, definition, lens: lensForDefinition(definition) });
    byMetricDecade.set(key, rows);
  }
  const rowsFor = (metricId: string, decade: LivesDecade) =>
    byMetricDecade.get(`${metricId}|${decade}`) ?? [];

  // Agency value series (NCHS life expectancy, infant mortality) name their group in the metric id
  // and carry no race slice, so the index above skips them. They are read here by census year.
  const valueSeriesIds = new Set(
    LIVES_CONDITIONS.flatMap((condition) => Object.values(condition.valueSeries ?? {})),
  );
  const valueByMetricDecade = new Map<string, LivesObservationInput>();
  for (const observation of input.observations) {
    if (!valueSeriesIds.has(observation.metricId)) continue;
    if (observation.jurisdictionId !== NATION_ID) continue;
    const decade = livesDecadeForReferencePeriod(observation.referencePeriod);
    if (decade !== null) valueByMetricDecade.set(`${observation.metricId}|${decade}`, observation);
  }

  const coverageIndex = new Map(
    input.coverage.map((entry) => [`${entry.decade}|${entry.key}|${entry.lens}`, entry]),
  );
  const framesByDecade = new Map(input.frames.map((frame) => [frame.decade, frame]));
  const worldByDecade = new Map<LivesDecade, LivesWorldBeat[]>();
  for (const beat of input.worldBeats ?? []) {
    if (beat.areaIds.length > 0 && !beat.areaIds.includes(area.id)) continue;
    const list = worldByDecade.get(beat.decade) ?? [];
    list.push({
      id: beat.id,
      domain: beat.domain,
      claimType: beat.claimType,
      heading: beat.heading,
      body: beat.body,
      citations: beat.citations,
      appliesTo: beat.lenses,
      unit: beat.unit,
      entities: beat.entityIds.map((id) => ({ id, href: null, label: id })),
      ...(beat.uncertaintyLabel ? { uncertaintyLabel: beat.uncertaintyLabel } : {}),
      ...(beat.gapState ? { gapState: beat.gapState } : {}),
      ...(beat.speaker ? { speaker: beat.speaker } : {}),
    });
    worldByDecade.set(beat.decade, list);
  }
  for (const entry of input.resolvedWorldBeats ?? []) {
    const list = worldByDecade.get(entry.decade) ?? [];
    list.push(entry.beat);
    worldByDecade.set(entry.decade, list);
  }

  const decades = LIVES_DECADES.map((decade, index): LivesDecadeBundle => {
    const regime = livesRegimeForDecade(decade);
    const previous = index > 0 ? LIVES_DECADES[index - 1]! : null;
    const hispanicCounting = livesHispanicCounting(decade);
    const notes = input.countNotes.filter(
      (note) =>
        note.decade === decade && (note.areaIds.length === 0 || note.areaIds.includes(area.id)),
    );
    // Only a note written for this group explains its missing figure; a note for everyone never does.
    const noteFor = (lens: LivesLens) => notes.find((note) => note.appliesTo.includes(lens))?.id;

    const withNote = (cell: LivesCell, lens: LivesLens): LivesCell => {
      if (cell.state !== 'not_measured' && cell.state !== 'suppressed') return cell;
      const noteId = noteFor(lens);
      return noteId ? { ...cell, noteId } : cell;
    };

    const overrideFor = (key: LivesConditionKey | 'class_share', lens: LivesLens) =>
      coverageIndex.get(`${decade}|${key}|${lens}`) ?? coverageIndex.get(`${decade}|${key}|all`);

    const hispanicUncounted = (lens: LivesLens): LivesCell | null =>
      lens === 'hispanic' && hispanicCounting === 'not_counted'
        ? {
            state: 'not_measured',
            reason: `The census did not count Hispanic Americans as a group in the ${decade}s.`,
          }
        : null;

    const scope = (rows: readonly IndexedRow[]) => {
      const nationRows = rows.filter((row) => row.jurisdictionId === NATION_ID);
      if (area.kind === 'nation' && nationRows.length > 0) {
        return { rows: nationRows, expected: [NATION_ID], derived: false };
      }
      return {
        rows: rows.filter((row) => memberIds.includes(row.jurisdictionId)),
        expected: memberIds,
        derived: true,
      };
    };

    const coverageCheck = (
      definition: CanonicalRaceEthnicitySlice,
      covered: readonly string[],
      expected: readonly string[],
    ): LivesCell | { readonly coveragePct?: number; readonly countedIn?: readonly string[] } => {
      if (OWN_SCOPE_DEFINITIONS.includes(definition)) {
        return { countedIn: covered.map((id) => names.get(id) ?? id) };
      }
      if (covered.length >= expected.length) return {};
      const population = new Map<string, number>();
      for (const row of rowsFor(LIVES_SERIES.population, decade)) {
        if (row.definition === definition && typeof row.numerator === 'number') {
          population.set(row.jurisdictionId, row.numerator);
        }
      }
      const share = coverageShare(covered, population, expected);
      if (share === null) {
        return {
          state: 'suppressed',
          reason:
            'Published for only some of the area’s states, and their share of the group is not known.',
        };
      }
      if (share < LIVES_MIN_COVERAGE) {
        return {
          state: 'suppressed',
          reason: `Published for only ${Math.round(share * 100)}% of the area’s group.`,
        };
      }
      return { coveragePct: share * 100 };
    };

    const sourcesOf = (rows: readonly IndexedRow[]): LivesSourceRef[] => {
      const seen = new Map<string, LivesSourceRef>();
      for (const row of rows) seen.set(row.sourceUrl, { label: row.source, url: row.sourceUrl });
      return [...seen.values()];
    };

    const pickDefinition = (rows: readonly IndexedRow[], lens: LivesLens) => {
      const lensRows = rows.filter((row) => row.lens === lens);
      const definition = preferredDefinition(
        lens,
        lensRows.map((row) => row.definition),
      );
      return definition === null
        ? null
        : { definition, rows: lensRows.filter((row) => row.definition === definition) };
    };

    const rateCell = (seriesId: string, key: LivesConditionKey, lens: LivesLens): LivesCell => {
      const uncounted = hispanicUncounted(lens);
      if (uncounted) return withNote(uncounted, lens);
      const override = overrideFor(key, lens);
      if (override) return withNote({ state: override.state, reason: override.reason }, lens);
      const picked = pickDefinition(rowsFor(seriesId, decade), lens);
      if (!picked) return { state: 'pending', reason: 'Not yet loaded for this area and decade.' };
      const { rows, expected, derived } = scope(picked.rows);
      const counts: StateCount[] = rows
        .filter((row) => typeof row.numerator === 'number' && typeof row.denominator === 'number')
        .map((row) => ({
          jurisdictionId: row.jurisdictionId,
          numerator: row.numerator as number,
          denominator: row.denominator as number,
        }));
      const aggregate = aggregateRate(counts, expected);
      if (!aggregate)
        return { state: 'pending', reason: 'Not yet loaded for this area and decade.' };
      const definitionLabel = RACE_ETHNICITY_DEFINITION_LABELS[picked.definition];
      const coverage = coverageCheck(picked.definition, aggregate.jurisdictionsCovered, expected);
      if ('state' in coverage) return { ...coverage, definitionLabel };
      if (aggregate.denominator < LIVES_MIN_BASE) {
        return { state: 'suppressed', reason: 'Too few counted to say.', definitionLabel };
      }
      const margin = proportionMargin(rows, aggregate.numerator, aggregate.denominator);
      const p = aggregate.ratePct / 100;
      const cv = margin !== null && p > 0 ? margin / 100 / Z_90 / p : null;
      if (cv !== null && cv > 0.3) {
        return {
          state: 'suppressed',
          reason: 'The survey margin is too wide to say.',
          definitionLabel,
        };
      }
      return {
        state: cv !== null && cv > 0.15 ? 'wide_margin' : 'published',
        estimate: aggregate.ratePct,
        ...(margin !== null ? { marginOfError: margin } : {}),
        definitionLabel,
        ...coverage,
        derived,
        sources: sourcesOf(rows),
        ...(rows.some((row) => row.id)
          ? { observationIds: rows.flatMap((row) => (row.id ? [row.id] : [])) }
          : {}),
      };
    };

    /** The population label a reader sees beside an agency value, in the agency's own terms. */
    const valueDefinitionLabel = (
      condition: LivesConditionDefinition,
      observation: LivesObservationInput,
    ): string => {
      const label = observation.populationLabel?.trim() ?? '';
      if (label === 'nonwhite') return RACE_ETHNICITY_DEFINITION_LABELS.nonwhite;
      if (condition.key === 'infant_mortality') {
        const basis = observation.populationBasis?.trim();
        return basis ? `${label} infants, by ${basis}` : `${label} infants`;
      }
      if (/^non-Hispanic single-race /.test(label)) {
        return `${label.replace(/^non-Hispanic single-race /, '')}, not Hispanic, one race, as NCHS reported it`;
      }
      return `${label}, all origins, as NCHS reported it`;
    };

    const valueCell = (condition: LivesConditionDefinition, lens: LivesLens): LivesCell => {
      if (input.area.kind !== 'nation') {
        return {
          state: 'not_measured',
          reason: 'NCHS publishes this for the whole country, not for regions.',
        };
      }
      if (lens === 'hispanic') {
        return {
          state: 'not_measured',
          reason: 'This series has no separate figure for Hispanic Americans.',
        };
      }
      const metricId = condition.valueSeries?.[lens];
      const observation = metricId ? valueByMetricDecade.get(`${metricId}|${decade}`) : undefined;
      if (!observation) {
        return { state: 'pending', reason: 'Not yet loaded for this area and decade.' };
      }
      if (!observation.populationLabel?.trim()) {
        // An agency value with no stated population is not publishable: that label IS the figure's
        // meaning, and the life expectancy series changes population twice.
        return { state: 'pending', reason: 'The source’s population label has not been recorded.' };
      }
      return {
        state: 'published',
        estimate: observation.estimate,
        definitionLabel: valueDefinitionLabel(condition, observation),
        sources: [{ label: observation.source, url: observation.sourceUrl }],
        ...(observation.id ? { observationIds: [observation.id] } : {}),
      };
    };

    const incomeBrackets = (lens: LivesLens) => {
      const bracketRows: IndexedRow[] = [];
      for (const [key, rows] of byMetricDecade) {
        const [metricId, rowDecade] = key.split('|');
        if (Number(rowDecade) !== decade || !parseIncomeBracketSeriesId(metricId!)) continue;
        bracketRows.push(...rows);
      }
      const picked = pickDefinition(bracketRows, lens);
      if (!picked) return null;
      const { rows, expected, derived } = scope(picked.rows);
      const byJurisdiction = new Map<string, IncomeBracket[]>();
      for (const row of rows) {
        const edges = parseIncomeBracketSeriesId(row.metricId);
        if (!edges || typeof row.numerator !== 'number') continue;
        const list = byJurisdiction.get(row.jurisdictionId) ?? [];
        list.push({ lower: edges.lower, upper: edges.upper, count: row.numerator });
        byJurisdiction.set(row.jurisdictionId, list);
      }
      const sets = [...byJurisdiction.values()].map((list) =>
        [...list].sort((a, b) => a.lower - b.lower),
      );
      return {
        definition: picked.definition,
        rows,
        expected,
        derived,
        covered: [...byJurisdiction.keys()],
        sets,
      };
    };

    const nationalMedian = rowsFor(LIVES_SERIES.incomeMedian, decade).find(
      (row) => row.jurisdictionId === NATION_ID && row.definition === 'all',
    );

    const classShares = mapLenses((lens) => {
      const unclassifiedIncome: LivesCell = {
        state: 'not_measured',
        reason: 'Income bands place every family or household in a band.',
      };
      const fill = (cell: LivesCell): Record<LivesClassBucket, LivesCell> => ({
        lower: cell,
        middle: cell,
        upper: cell,
        unclassified: regime === 'work_based' ? cell : unclassifiedIncome,
      });
      const uncounted = hispanicUncounted(lens);
      if (uncounted) return fill(withNote(uncounted, lens));
      const override = overrideFor('class_share', lens);
      if (override) return fill(withNote({ state: override.state, reason: override.reason }, lens));
      const pending: LivesCell = {
        state: 'pending',
        reason: 'Not yet loaded for this area and decade.',
      };

      if (regime === 'work_based') {
        const allRows = LIVES_CLASS_BUCKETS.flatMap((bucket) =>
          rowsFor(workClassSeriesId(bucket), decade),
        );
        const picked = pickDefinition(allRows, lens);
        if (!picked) return fill(pending);
        const { rows, expected } = scope(picked.rows);
        const countsByBucket = mapBuckets((bucket) =>
          rows
            .filter((row) => row.metricId === workClassSeriesId(bucket))
            .map((row) => ({
              jurisdictionId: row.jurisdictionId,
              numerator: row.numerator ?? 0,
              denominator: 0,
            })),
        );
        const distribution = aggregateDistribution(countsByBucket, expected);
        if (!distribution) return fill(pending);
        const definitionLabel = RACE_ETHNICITY_DEFINITION_LABELS[picked.definition];
        const covered = [...new Set(rows.map((row) => row.jurisdictionId))];
        const coverage = coverageCheck(picked.definition, covered, expected);
        if ('state' in coverage) return fill({ ...coverage, definitionLabel });
        if (distribution.total < LIVES_MIN_BASE) {
          return fill({ state: 'suppressed', reason: 'Too few counted to say.', definitionLabel });
        }
        const sources = sourcesOf(rows);
        return mapBuckets((bucket): LivesCell => ({
          state: 'published',
          estimate: distribution.sharesPct[bucket],
          definitionLabel,
          ...coverage,
          derived: true,
          sources,
        }));
      }

      const brackets = incomeBrackets(lens);
      if (!brackets) return fill(pending);
      if (!nationalMedian) {
        return fill({
          state: 'pending',
          reason: 'The national median for this decade is not yet loaded.',
        });
      }
      const definitionLabel = RACE_ETHNICITY_DEFINITION_LABELS[brackets.definition];
      const coverage = coverageCheck(brackets.definition, brackets.covered, brackets.expected);
      if ('state' in coverage) return fill({ ...coverage, definitionLabel });
      let summed: IncomeBracket[];
      try {
        summed = sumBrackets(brackets.sets);
      } catch {
        return fill({
          state: 'suppressed',
          reason: 'States published this in different bracket layouts, so they cannot be combined.',
          definitionLabel,
        });
      }
      const total = summed.reduce((sum, bracket) => sum + bracket.count, 0);
      if (total < LIVES_MIN_BASE) {
        return fill({ state: 'suppressed', reason: 'Too few counted to say.', definitionLabel });
      }
      const bands = estimateBandShares(summed, nationalMedian.estimate);
      if (!bands) {
        return fill({
          state: 'suppressed',
          reason: 'The published brackets are too coarse to place the band thresholds.',
          definitionLabel,
        });
      }
      const sources = sourcesOf([...brackets.rows, nationalMedian]);
      const band = (estimate: number): LivesCell => ({
        state: 'published',
        estimate,
        definitionLabel,
        ...coverage,
        derived: true,
        sources,
      });
      return {
        lower: band(bands.lowerPct),
        middle: band(bands.middlePct),
        upper: band(bands.upperPct),
        unclassified: unclassifiedIncome,
      };
    });

    const conditionsWithoutGaps = LIVES_CONDITIONS.map((condition): LivesConditionBundle => ({
      key: condition.key,
      label: livesConditionLabel(condition.key, regime),
      universe: condition.universe,
      ...(condition.unit && condition.unit !== 'percent' ? { unit: condition.unit } : {}),
      cells: mapLenses((lens) => {
        if (condition.valueSeries) {
          if (!livesConditionPublishedIn(condition, decade)) {
            return {
              state: 'not_measured',
              reason: `This NCHS series has no figure for ${decade}.`,
            };
          }
          return valueCell(condition, lens);
        }
        if (!livesConditionPublishedIn(condition, decade)) {
          return {
            state: 'not_measured',
            reason: `The census didn’t publish this by race in the ${decade}s.`,
          };
        }
        if (condition.seriesId !== null) {
          return rateCell(condition.seriesId, condition.key, lens);
        }
        const uncounted = hispanicUncounted(lens);
        if (uncounted) return withNote(uncounted, lens);
        const brackets = incomeBrackets(lens);
        if (!brackets || !nationalMedian) {
          return { state: 'pending', reason: 'Not yet loaded for this area and decade.' };
        }
        let summed: IncomeBracket[];
        try {
          summed = sumBrackets(brackets.sets);
        } catch {
          return { state: 'suppressed', reason: 'States published different bracket layouts.' };
        }
        const median = estimateMedian(summed);
        const definitionLabel = RACE_ETHNICITY_DEFINITION_LABELS[brackets.definition];
        if (median === null) {
          return {
            state: 'suppressed',
            reason: 'The published brackets are too coarse to estimate a median.',
            definitionLabel,
          };
        }
        return {
          state: 'published',
          estimate: (100 * median) / nationalMedian.estimate,
          definitionLabel,
          derived: true,
          sources: sourcesOf([...brackets.rows, nationalMedian]),
        };
      }),
    }));

    // A gap is derived only where two groups each have a RATE of the same outcome. Two measures
    // are not that. The income condition is a ratio to the national median built from brackets.
    // Population share is each group's slice of ONE total, so the distance between the Black and
    // white slices is not a gap between groups at all ("76 points apart" was the tell).
    const conditions = conditionsWithoutGaps.map((bundle): LivesConditionBundle => {
      const spec = LIVES_CONDITIONS.find((condition) => condition.key === bundle.key);
      if (!spec || !livesConditionIsGroupRate(bundle.key)) return bundle;
      // The income condition is the only one with neither a stored rate series nor a value series.
      if (spec.seriesId === null && !spec.valueSeries) return bundle;
      const gap = deriveLivesConditionGap(bundle.cells, spec.unit ?? 'percent');
      return gap ? { ...bundle, gap } : bundle;
    });

    const allowed = new Set(area.kind === 'nation' ? [NATION_ID] : [NATION_ID, ...memberIds]);
    const rulesInForce = input.applicability
      .filter((row) => allowed.has(row.jurisdictionId))
      .filter(
        (row) =>
          row.inForceFromYear <= decade + 9 &&
          (row.inForceToYear === null || row.inForceToYear >= decade),
      )
      .map((row): LivesRule => ({
        id: row.id,
        entityId: row.entityId,
        name: row.entityName,
        href: row.entityHref,
        scopeLevel: row.scopeLevel,
        jurisdictionLabel:
          row.jurisdictionId === NATION_ID
            ? 'Federal'
            : (names.get(row.jurisdictionId) ?? row.jurisdictionId),
        inForceFromYear: row.inForceFromYear,
        inForceToYear: row.inForceToYear,
        appliesTo: row.appliesToSlices.includes('all')
          ? [...LIVES_LENSES]
          : LIVES_LENSES.filter((lens) => row.appliesToSlices.includes(lens)),
        groupsNamed: row.groupsNamed,
        lifeDomains: row.lifeDomains,
        textPosture: row.textPosture,
        disputed: row.disputed,
        summary: row.summary,
        description: row.description ?? null,
      }))
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
      hispanicCounting,
      classLabel: LIVES_REGIME_DESCRIPTIONS[regime].classLabel,
      countNotes: notes.map(({ id, heading, body, appliesTo, citations }) => ({
        id,
        heading,
        body,
        appliesTo,
        citations,
      })),
      classShares,
      conditions,
      rulesInForce,
      frame: frame ? { heading: frame.heading, paragraphs: frame.paragraphs } : null,
      worldBeats: worldByDecade.get(decade) ?? [],
    };
  });

  return {
    areaId: area.id,
    areaSlug: area.slug,
    areaName: area.name,
    areaKind: area.kind,
    decades,
    disclaimer: JUXTAPOSITION_DISCLAIMER,
  };
}

/**
 * The change in a published value between two decades, or null when the comparison would cross a
 * measurement boundary or either value is missing.
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

/**
 * 90% margin, in percentage points, of a proportion summed from published ACS counts, using the Census
 * Bureau's formula for derived proportions. Null unless every row carries both count margins.
 */
function proportionMargin(
  rows: readonly LivesObservationInput[],
  numerator: number,
  denominator: number,
): number | null {
  if (rows.length === 0 || denominator <= 0) return null;
  let numeratorVariance = 0;
  let denominatorVariance = 0;
  for (const row of rows) {
    const numeratorMoe = row.metadata?.numeratorMoe;
    const denominatorMoe = row.metadata?.denominatorMoe;
    if (typeof numeratorMoe !== 'number' || typeof denominatorMoe !== 'number') return null;
    numeratorVariance += numeratorMoe ** 2;
    denominatorVariance += denominatorMoe ** 2;
  }
  const p = numerator / denominator;
  let radicand = numeratorVariance - p ** 2 * denominatorVariance;
  if (radicand < 0) radicand = numeratorVariance + p ** 2 * denominatorVariance;
  return (100 * Math.sqrt(radicand)) / denominator;
}

function boundaryKind(previous: LivesDecade, current: LivesDecade): LivesBoundaryKind {
  const a = livesRegimeForDecade(previous);
  const b = livesRegimeForDecade(current);
  if (a === b) return 'none';
  return livesRegimesShareIncomeFooting(a, b) ? 'method_note' : 'different_measure';
}

function mapLenses<T>(build: (lens: LivesLens) => T): Readonly<Record<LivesLens, T>> {
  return { black: build('black'), white: build('white'), hispanic: build('hispanic') };
}

function mapBuckets<T>(build: (bucket: LivesClassBucket) => T): Record<LivesClassBucket, T> {
  return {
    lower: build('lower'),
    middle: build('middle'),
    upper: build('upper'),
    unclassified: build('unclassified'),
  };
}
