/**
 * Dispute-and-correction compatibility for historic-safety layer records.
 *
 * Place-context layers are claims: every `PlaceConditionDesignationRecord`
 * (`./layer-record.ts`) and every `LayerSignal` (`./types.ts`) traces back to one or more
 * `basisClaimIds` from the ordinary claims model (`../claims/index.js`). This module does
 * not invent a new dispute mechanism — it maps a layer record onto the claim ids the existing
 * dispute/correction machinery already handles:
 * - Public intake (`apps/web/src/app/corrections/categories.ts`) already has a `'claim'`
 * `CorrectionTargetType`, a `'classification_dispute'` category (e.g. disputed Tougaloo
 * confidence or HOLC grade), and a `'location_precision'` category (disputed area geometry /
 * precision tier). This module only documents that mapping; it does not import from apps/web.
 * - Internal contradiction preservation (`../claims/contradictions.js`
 * `preserveContradictoryValues`) already handles a disputed claim's alternate values; a
 * disputed layer-record claim goes through that same path.
 *
 * Not wired live: when a moderation surface resolves a dispute against a claim id in a layer
 * record's `basisClaimIds`, the caller should re-run this layer's `compute*LayerSignal`
 * function (or, for a designation record, re-derive the record from the claim's updated
 * preserved values) rather than hand-editing the stored layer record — numbers are always
 * derived from basis claims, never edited independently of them.
 */
import type {
  PlaceConditionDesignationKind,
  PlaceConditionDesignationRecord,
} from './layer-record.js';
import type { LayerSignal } from './types.js';

/** One disputable target: a single basis-claim id on a layer record, plus enough context for a
 * moderation surface to route the dispute (which record, which place, which designation kind). */
export type DesignationDisputeTarget = {
  readonly claimId: string;
  readonly recordId: string;
  readonly recordKind: PlaceConditionDesignationKind;
  readonly placeEntityId: string;
};

/**
 * Every basis claim on a designation record is independently disputable \u2014 disputing one claim
 * never silently invalidates the others (mirrors../claims/contradictions.js's own
 * "preserve, never silently resolve" discipline).
 */
export function designationDisputeTargets(
  record: PlaceConditionDesignationRecord,
): readonly DesignationDisputeTarget[] {
  return record.basisClaimIds.map((claimId) => ({
    claimId,
    recordId: record.id,
    recordKind: record.designation,
    placeEntityId: record.placeEntityId,
  }));
}

/** Same mapping for a computed `LayerSignal`'s citations \u2014 every layer's cited claims are
 * disputable through the same existing 'claim' correction target type. */
export function layerSignalDisputeTargets(
  signal: LayerSignal,
): readonly Pick<DesignationDisputeTarget, 'claimId' | 'placeEntityId'>[] {
  return signal.citations.map((citation) => ({
    claimId: citation.claimId,
    placeEntityId: signal.placeEntityId,
  }));
}

/**
 * Recommended `CorrectionCategory` (per `apps/web/src/app/corrections/categories.ts`'s existing
 * closed vocabulary \u2014 quoted here as documentation only, this module does not import that
 * app-layer file) for a dispute against a given designation kind. Sundown-town confidence and
 * HOLC grade disputes are classification disputes; the area-geometry binding is a location-
 * precision dispute.
 */
export function recommendedCorrectionCategoryFor(
  recordKind: PlaceConditionDesignationKind,
): 'classification_dispute' | 'location_precision' {
  if (recordKind === 'sundown_town' || recordKind === 'redlining_grade') {
    return 'classification_dispute';
  }
  return 'location_precision';
}

/**
 * True when a resolved dispute (a set of claim ids the moderation surface determined were
 * disputed/retracted) invalidates a designation record's evidentiary basis entirely \u2014 i.e.
 * every one of the record's basis claims was disputed, leaving zero supporting claims. A partial
 * dispute (some but not all basis claims affected) never auto-invalidates the record; it is left
 * to the caller to re-derive the record from the claims' updated preserved values, per the
 * not-wired-live note above.
 */
export function designationRecordFullyDisputed(
  record: Pick<PlaceConditionDesignationRecord, 'basisClaimIds'>,
  disputedClaimIds: ReadonlySet<string>,
): boolean {
  if (record.basisClaimIds.length === 0) return false;
  return record.basisClaimIds.every((claimId) => disputedClaimIds.has(claimId));
}
