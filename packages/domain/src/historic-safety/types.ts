/**
 * Shared vocabulary for the historic-safety and place-context engine: the five layer
 * identifiers, the citation/methodology-note shapes every layer publishes, and the "as of" dating
 * discipline every layer and the composite share.
 *
 * CRITICAL INVARIANT (see ./scoring-guard.ts for the enforced version): there is never one opaque
 * safety score. Each layer is separately computed, separately cited, separately dated, and shown
 * with its own methodology note. The composite (./composite.ts) draws ONLY from layers 1-4;
 * layer 5's general-crime component never scores anything, and advisory data never scores
 * anything (extends the discipline already established in ../advisory.ts).
 */

/** The five layers, in fixed design order. */
export const HISTORIC_SAFETY_LAYER_IDS = [
  'documented_events',
  'sundown_town',
  'exclusion_infrastructure',
  'presence_affirmation',
  'modern_context',
] as const;

export type HistoricSafetyLayerId = (typeof HISTORIC_SAFETY_LAYER_IDS)[number];

export function isHistoricSafetyLayerId(value: string): value is HistoricSafetyLayerId {
  return (HISTORIC_SAFETY_LAYER_IDS as readonly string[]).includes(value);
}

/** Layers 1-4 feed the composite; layer 5 (modern-context) never does (invariant). */
export const COMPOSITE_ELIGIBLE_LAYER_IDS = [
  'documented_events',
  'sundown_town',
  'exclusion_infrastructure',
  'presence_affirmation',
] as const satisfies readonly HistoricSafetyLayerId[];

export type CompositeEligibleLayerId = (typeof COMPOSITE_ELIGIBLE_LAYER_IDS)[number];

export function isCompositeEligibleLayerId(value: string): value is CompositeEligibleLayerId {
  return (COMPOSITE_ELIGIBLE_LAYER_IDS as readonly string[]).includes(value);
}

/** Human-facing layer labels procedural, never a danger/safety verdict framing. */
export const HISTORIC_SAFETY_LAYER_LABELS: Readonly<Record<HistoricSafetyLayerId, string>> = {
  documented_events: 'Documented historic events',
  sundown_town: 'Sundown-town designation history',
  exclusion_infrastructure: 'Exclusion infrastructure (redlining and covenants)',
  presence_affirmation: 'Black presence and community life',
  modern_context: 'Modern context (hate-crime data and advisories)',
};

/**
 * One citation a layer's computation drew on. `claimId` links back to the claims model
 * (see ../claims/index.js) so every layer datum is an ordinary, disputable claim never an
 * unsourced number. `retrievedAt` and `capturePointerId` support capture-pointer
 * integration without duplicating that module's own shapes here.
 */
export type LayerCitation = {
  readonly claimId: string;
  readonly sourceLabel: string;
  readonly retrievedAt: string;
  readonly capturePointerId?: string;
};

export function assertLayerCitationValid(citation: LayerCitation): void {
  if (!citation.claimId.trim()) throw new Error('LayerCitation.claimId is required');
  if (!citation.sourceLabel.trim()) throw new Error('LayerCitation.sourceLabel is required');
  if (!Number.isFinite(Date.parse(citation.retrievedAt))) {
    throw new Error('LayerCitation.retrievedAt must be an ISO date');
  }
}

/**
 * Every layer publishes its own reviewable methodology note prose, not a formula hidden in
 * code. Mirrors the NOTABILITY_RUBRIC convention (../entity-status.js): auditable, versioned text
 * a human can ratify, distinct from the numeric computation it documents.
 */
export type LayerMethodologyNote = {
  readonly layerId: HistoricSafetyLayerId;
  readonly methodologyVersion: string;
  readonly summary: string;
  readonly biasCaveat?: string;
};

export function assertLayerMethodologyNoteValid(note: LayerMethodologyNote): void {
  if (!isHistoricSafetyLayerId(note.layerId)) {
    throw new Error(`Unknown historic-safety layer id: ${note.layerId}`);
  }
  if (!note.methodologyVersion.trim()) throw new Error('methodologyVersion is required');
  if (!note.summary.trim()) throw new Error('summary is required');
}

/**
 * The shape every layer's computed output shares: a bounded [0,1] signal value (never a raw
 * "safety score" label), its own citations, its own methodology note, and its own "as of" date
 * "history does not expire," so `asOf` records when the layer was last recomputed, not a decay
 * clock. `layerId` and `signalVersion` make every layer output independently auditable.
 */
export type LayerSignal = {
  readonly layerId: HistoricSafetyLayerId;
  readonly signalVersion: string;
  readonly placeEntityId: string;
  /** Bounded [0,1]; presentation language is capped by../scoring-guard.js callers, never a
   * standalone "safety" label rendered from this number alone. */
  readonly value: number;
  readonly asOf: string;
  readonly citations: readonly LayerCitation[];
  readonly methodologyNote: LayerMethodologyNote;
  readonly notes?: string;
};

export function assertLayerSignalValid(signal: LayerSignal): void {
  if (!isHistoricSafetyLayerId(signal.layerId)) {
    throw new Error(`Unknown historic-safety layer id: ${signal.layerId}`);
  }
  if (!signal.signalVersion.trim()) throw new Error('signalVersion is required');
  if (!signal.placeEntityId.trim()) throw new Error('placeEntityId is required');
  if (!Number.isFinite(signal.value) || signal.value < 0 || signal.value > 1) {
    throw new RangeError('LayerSignal.value must be a finite number in [0, 1]');
  }
  if (!Number.isFinite(Date.parse(signal.asOf))) {
    throw new Error('LayerSignal.asOf must be an ISO date');
  }
  if (signal.citations.length === 0) {
    throw new Error('LayerSignal requires at least one citation — never an unsourced signal');
  }
  for (const citation of signal.citations) {
    assertLayerCitationValid(citation);
  }
  if (signal.methodologyNote.layerId !== signal.layerId) {
    throw new Error('LayerSignal.methodologyNote.layerId must match the signal\'s own layerId');
  }
  assertLayerMethodologyNoteValid(signal.methodologyNote);
}
