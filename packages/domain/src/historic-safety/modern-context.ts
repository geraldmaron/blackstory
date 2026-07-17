/**
 * Layer 5 — modern context. Handled with extreme care, per the bead design:
 *
 *   - FBI annual hate-crime statistics (bias-motivated incidents) are the primary modern signal.
 *     They render as an ordinary `LayerSignal` (methodology, citations, as-of date) so they get
 *     the same layered-signal treatment as layers 1-4 for DISPLAY purposes \u2014 but layer 5 is
 *     NEVER composite-eligible (see ../types.js's `COMPOSITE_ELIGIBLE_LAYER_IDS`, which omits
 *     `modern_context` entirely) and this module's `methodologyNote.biasCaveat` is always
 *     populated (AC2's "explicit bias caveat" requirement).
 *   - General crime reporting (FBI CDE/NIBRS) is recorded ONLY as clearly labeled context with an
 *     explicit bias caveat, using `GeneralCrimeContextRecord` from ./scoring-guard.ts \u2014 a type
 *     that deliberately has NO numeric "score" field a caller could mistake for a `LayerSignal`
 *     and feed into anything. `buildGeneralCrimeContextView` never returns a `LayerSignal`.
 *   - NAACP-style travel advisories are BB-095's own claims (../advisory.ts `PlaceAdvisoryRecord`)
 *     and surface EXCLUSIVELY through BB-095's advisory presentation \u2014 this module does not
 *     define a parallel advisory type; `modernContextAdvisoryPointer` is a thin, read-only
 *     pointer helper so a caller assembling a Layer 5 view can find a place's advisories without
 *     this module ever holding, deriving from, or scoring advisory data itself.
 */
import type { PlaceAdvisoryRecord } from '../advisory.js';
import { GENERAL_CRIME_CONTEXT_BIAS_CAVEAT, type GeneralCrimeContextRecord } from './scoring-guard.js';
import { assertLayerCitationValid, type LayerCitation, type LayerSignal } from './types.js';

export const MODERN_CONTEXT_METHODOLOGY_VERSION = 'modern-context-methodology.v1' as const;

export const HATE_CRIME_BIAS_CAVEAT =
  'FBI hate-crime statistics depend on local law-enforcement reporting and victim willingness to ' +
  'report, both of which vary by jurisdiction; a lower count can reflect under-reporting rather ' +
  'than fewer incidents. This signal is on-mission (bias-motivated incidents are the direct topic) ' +
  'but is still one dated, cited data point \u2014 not a real-time safety assessment.';

/** Published linear saturation cap (methodology, versioned above): incident counts at or above
 *  this threshold reach the maximum [0,1] signal value; below it, the value scales linearly. */
export const HATE_CRIME_SATURATION_INCIDENT_COUNT = 5;

export type HateCrimeStatRecord = {
  readonly placeEntityId: string;
  /** Bias-motivated incidents targeting Black people specifically, per the FBI annual release. */
  readonly biasMotivatedIncidentCount: number;
  readonly reportingYear: string;
  readonly citation: LayerCitation;
};

export function assertHateCrimeStatRecordValid(record: HateCrimeStatRecord): void {
  if (!record.placeEntityId.trim()) throw new Error('HateCrimeStatRecord.placeEntityId is required');
  if (!Number.isFinite(record.biasMotivatedIncidentCount) || record.biasMotivatedIncidentCount < 0) {
    throw new RangeError('HateCrimeStatRecord.biasMotivatedIncidentCount must be a non-negative number');
  }
  if (!record.reportingYear.trim()) throw new Error('HateCrimeStatRecord.reportingYear is required');
  assertLayerCitationValid(record.citation);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export type ComputeModernContextLayerInput = {
  readonly placeEntityId: string;
  readonly hateCrimeStats: readonly HateCrimeStatRecord[];
  readonly asOf: string;
};

/**
 * Never fabricates a signal when no FBI hate-crime release covers the place \u2014 absence of a
 * record means "no data for this reporting year," never "zero incidents confirmed." The returned
 * signal (when present) ALWAYS carries `methodologyNote.biasCaveat` and is layerId
 * `modern_context`, which `COMPOSITE_ELIGIBLE_LAYER_IDS` structurally excludes from ./composite.ts.
 */
export function computeModernContextLayerSignal(
  input: ComputeModernContextLayerInput,
): LayerSignal | undefined {
  const records = input.hateCrimeStats.filter((r) => r.placeEntityId === input.placeEntityId);
  if (records.length === 0) return undefined;
  for (const record of records) {
    assertHateCrimeStatRecordValid(record);
  }

  const totalIncidents = records.reduce((sum, r) => sum + r.biasMotivatedIncidentCount, 0);
  const value = round4(clamp01(totalIncidents / HATE_CRIME_SATURATION_INCIDENT_COUNT));
  const years = [...new Set(records.map((r) => r.reportingYear))].sort();

  return {
    layerId: 'modern_context',
    signalVersion: MODERN_CONTEXT_METHODOLOGY_VERSION,
    placeEntityId: input.placeEntityId,
    value,
    asOf: input.asOf,
    citations: records.map((record) => record.citation),
    methodologyNote: {
      layerId: 'modern_context',
      methodologyVersion: MODERN_CONTEXT_METHODOLOGY_VERSION,
      summary:
        'FBI annual hate-crime statistics (bias-motivated incidents), the primary modern signal ' +
        `for this layer. Reporting year(s): ${years.join(', ')}. This layer is DISPLAYED like ` +
        'layers 1-4 but is NEVER composite-eligible \u2014 see ./composite.ts.',
      biasCaveat: HATE_CRIME_BIAS_CAVEAT,
    },
    notes: `Bias-motivated incidents (total across reporting years shown): ${totalIncidents}`,
  };
}

// ---------------------------------------------------------------------------
// General crime — labeled context only, never a LayerSignal, never scored
// ---------------------------------------------------------------------------

export type BuildGeneralCrimeContextViewInput = {
  readonly placeEntityId: string;
  readonly nibrsOffenseCount?: number;
  readonly reportedCrimeRate?: number;
  readonly asOf: string;
  readonly sourceLabel: string;
};

/**
 * Builds a `GeneralCrimeContextRecord` \u2014 deliberately NOT a `LayerSignal` (no `value` field
 * exists on this type) so it structurally cannot be mistaken for a scoreable layer output.
 * Always stamps the mandatory `policingPatternCaveat` verbatim; a caller cannot override it.
 */
export function buildGeneralCrimeContextView(
  input: BuildGeneralCrimeContextViewInput,
): GeneralCrimeContextRecord {
  const record: GeneralCrimeContextRecord = {
    placeEntityId: input.placeEntityId,
    ...(input.nibrsOffenseCount !== undefined ? { nibrsOffenseCount: input.nibrsOffenseCount } : {}),
    ...(input.reportedCrimeRate !== undefined ? { reportedCrimeRate: input.reportedCrimeRate } : {}),
    asOf: input.asOf,
    sourceLabel: input.sourceLabel,
    policingPatternCaveat: GENERAL_CRIME_CONTEXT_BIAS_CAVEAT,
  };
  assertGeneralCrimeContextValid(record);
  return record;
}

/** Fails closed if the mandatory bias caveat is missing or altered \u2014 the caveat text is not
 *  caller-configurable. */
export function assertGeneralCrimeContextValid(record: GeneralCrimeContextRecord): void {
  if (!record.placeEntityId.trim()) throw new Error('GeneralCrimeContextRecord.placeEntityId is required');
  if (!Number.isFinite(Date.parse(record.asOf))) {
    throw new Error('GeneralCrimeContextRecord.asOf must be an ISO date');
  }
  if (!record.sourceLabel.trim()) throw new Error('GeneralCrimeContextRecord.sourceLabel is required');
  if (record.policingPatternCaveat !== GENERAL_CRIME_CONTEXT_BIAS_CAVEAT) {
    throw new Error(
      'GeneralCrimeContextRecord.policingPatternCaveat must equal GENERAL_CRIME_CONTEXT_BIAS_CAVEAT ' +
        'verbatim \u2014 the caveat is mandatory and not caller-configurable (BB-082 critical invariant).',
    );
  }
  // Defense-in-depth: even this labeled-context-only record must never carry a composite/scoring
  // shape (e.g. an accidental `value` or `score` field bolted on by a future edit). Its own
  // crime-context field names (nibrsOffenseCount, etc.) are expected here — only composite shapes
  // are forbidden.
  const forbiddenScoringShapeKeys = ['value', 'score', 'layerContributions', 'layerId', 'missingLayers'] as const;
  for (const key of forbiddenScoringShapeKeys) {
    if (key in (record as Record<string, unknown>)) {
      throw new Error(
        `GeneralCrimeContextRecord must not carry composite/scoring field "${key}" — general crime ` +
          'context is labeled presentation only, never a LayerSignal or composite input.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Advisory pointer — BB-095 owns the record and the presentation, this is read-only
// ---------------------------------------------------------------------------

/**
 * Filters an already-loaded advisory list down to one place \u2014 a convenience pointer, not a
 * new advisory type or a scoring path. Callers should render the result through BB-095's own
 * presentation (`apps/web/src/components/AdvisoryNotice.tsx`, `../disclaimers.js`'s
 * `safety_advisory` disclaimer), never through this package's own historic-safety presenters.
 */
export function modernContextAdvisoryPointer(
  placeEntityId: string,
  advisories: readonly PlaceAdvisoryRecord[],
): readonly PlaceAdvisoryRecord[] {
  return advisories.filter((advisory) => advisory.placeEntityId === placeEntityId);
}
