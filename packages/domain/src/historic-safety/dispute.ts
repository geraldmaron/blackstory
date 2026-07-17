/**
 * BB-053/BB-055 dispute-and-correction compatibility for BB-082 layer records (AC6).
 *
 * Place-context layers are claims: every `PlaceConditionDesignationRecord`
 * (./layer-record.ts) and every `LayerSignal` (./types.ts) traces back to >=1 `basisClaimIds` /
 * citation `claimId`s from the ordinary BB-017 claims model (../claims/index.js). This module does
 * NOT invent a new dispute mechanism or a new correction target type \u2014 it maps a layer record
 * onto the CLAIM ids the existing dispute/correction machinery already knows how to handle:
 *   - Public intake (`apps/web/src/app/corrections/categories.ts`) already has a `'claim'`
 *     `CorrectionTargetType` and a `'classification_dispute'` `CorrectionCategory` (fits a
 *     disputed Tougaloo confidence level or HOLC grade) and a `'location_precision'` category
 *     (fits a disputed area-geometry/precision-tier binding) \u2014 apps/web is outside this
 *     package's file ownership, so this module only documents the mapping, it does not import
 *     from apps/web.
 *   - Internal contradiction preservation (`../claims/contradictions.js`
 *     `preserveContradictoryValues`) already handles a disputed claim's alternate values; a
 *     disputed layer-record claim goes through that exact path like any other claim.
 *
 * INTEGRATION POINT (documented, not live-wired \u2014 same convention as
 * ../geography/jurisdiction-refs.ts's own "INTEGRATION POINT" comment): when BB-053/BB-055's
 * moderation surface resolves a dispute against a claim id that appears in a layer record's
 * `basisClaimIds`, the caller should re-run this layer's `compute*LayerSignal` function (or, for
 * a designation record, re-derive the record from the claim's updated preserved values) rather
 * than hand-editing the stored layer record \u2014 the record's numbers are always DERIVED from its
 * basis claims, never edited independently of them.
 */
import type {
  PlaceConditionDesignationKind,
  PlaceConditionDesignationRecord,
} from './layer-record.js';
import type { LayerSignal } from './types.js';

/** One disputable target: a single basis-claim id on a layer record, plus enough context for a
 *  moderation surface to route the dispute (which record, which place, which designation kind). */
export type DesignationDisputeTarget = {
  readonly claimId: string;
  readonly recordId: string;
  readonly recordKind: PlaceConditionDesignationKind;
  readonly placeEntityId: string;
};

/**
 * Every basis claim on a designation record is independently disputable \u2014 disputing one claim
 * never silently invalidates the others (mirrors ../claims/contradictions.js's own
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
 *  disputable through the same existing 'claim' correction target type. */
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
 * to the caller to re-derive the record from the claims' updated preserved values, per this
 * module's INTEGRATION POINT note above.
 */
export function designationRecordFullyDisputed(
  record: Pick<PlaceConditionDesignationRecord, 'basisClaimIds'>,
  disputedClaimIds: ReadonlySet<string>,
): boolean {
  if (record.basisClaimIds.length === 0) return false;
  return record.basisClaimIds.every((claimId) => disputedClaimIds.has(claimId));
}
