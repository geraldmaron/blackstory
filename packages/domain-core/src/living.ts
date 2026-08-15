/**
 * Living-status helpers backed by the product constitution (@repo/schemas).
 * Unknown living status is treated as living at the model level.
 */
import { evaluateLivingStatus, loadProductConstitution } from '@repo/schemas';

/** Living-status vocabulary from the active product constitution. */
export function livingStatuses(): readonly string[] {
  return loadProductConstitution().livingPersonRules.statuses;
}

export type LivingStatus = string;

/** Unknown living status is treated as living (constitution livingPersonRules). */
export function treatAsLiving(status: LivingStatus): boolean {
  return evaluateLivingStatus(status).treatAsLiving;
}

/** Default living status when writers omit one unknown, therefore treated as living. */
export const DEFAULT_LIVING_STATUS: LivingStatus = 'unknown';

/** Signals used to derive a living-status guess (the related workstream). Nothing beyond birth/death
 * years exists as a structured signal in this model today; this is intentionally minimal. */
export type LivingStatusDerivationSignal = {
  readonly birthYear?: number | null;
  readonly deathYear?: number | null;
  /**
   * When true, a recent life signal (publication, office held, etc.) within the last two years
   * blocks the WP:BDP presumed-deceased inference. Absence of this flag means no evidence-of-life
   * was supplied — not the same as asserting the person is living.
   */
  readonly recentLifeEvidence?: boolean;
  /** Override "now" for deterministic tests; defaults to the real current year. */
  readonly asOfYear?: number;
};

/**
 * WP:BDP plausibility bound — birth more than this many years ago with no death year and no
 * recent life evidence yields `presumed_deceased`, not evidenced `deceased`.
 *
 * COMMEMORATIVE-LOCATION GATE: `presumed_deceased` counts as deceased for commemorative-location
 * eligibility only after operator confirmation (`apply-person-commemorative-locations.ts`). Do not
 * auto-promote commemorative pins from this token alone.
 */
export const MAX_PLAUSIBLE_HUMAN_AGE_YEARS = 115;

/** Backfill scripts use this window when scanning for recent life evidence in claim years. */
export const RECENT_LIFE_EVIDENCE_YEARS = 2;

/**
 * Derives a living-status GUESS from birth/death year signals only.
 *
 * PRIVACY FAIL-SAFE: this must never independently assert `'living'` from absence of evidence —
 * it can only assert `'deceased'` from positive/plausibility evidence, or fall back to
 * `DEFAULT_LIVING_STATUS` ('unknown', which `treatAsLiving` already treats as living). This
 * mirrors the model-level default documented in the module doc above. Not wired into any publish
 * pipeline in this pass (see `deriveEntityLivingStatus` in `./entity.ts`).
 */
export function deriveLivingStatus(signal: LivingStatusDerivationSignal): LivingStatus {
  if (signal.deathYear !== undefined && signal.deathYear !== null) {
    return 'deceased';
  }
  if (signal.birthYear !== undefined && signal.birthYear !== null) {
    const asOfYear = signal.asOfYear ?? new Date().getUTCFullYear();
    if (asOfYear - signal.birthYear > MAX_PLAUSIBLE_HUMAN_AGE_YEARS && !signal.recentLifeEvidence) {
      return 'presumed_deceased';
    }
  }
  return DEFAULT_LIVING_STATUS;
}
