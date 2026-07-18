/**
 * Living-status helpers backed by the product constitution (@blap/schemas).
 * Unknown living status is treated as living at the model level.
 */
import { evaluateLivingStatus, loadProductConstitution } from '@blap/schemas';

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

/** Signals used to derive a living-status guess (black-book-mpfb). Nothing beyond birth/death
 * years exists as a structured signal in this model today; this is intentionally minimal. */
export type LivingStatusDerivationSignal = {
  readonly birthYear?: number | null;
  readonly deathYear?: number | null;
  /** Override "now" for deterministic tests; defaults to the real current year. */
  readonly asOfYear?: number;
};

/** No documented death, but an implausibly old birth year, is treated as evidence of death
 * rather than left "unknown" — this is a plausibility inference from a concrete signal, not a
 * guess from absence of evidence. */
const MAX_PLAUSIBLE_HUMAN_AGE_YEARS = 115;

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
    if (asOfYear - signal.birthYear > MAX_PLAUSIBLE_HUMAN_AGE_YEARS) {
      return 'deceased';
    }
  }
  return DEFAULT_LIVING_STATUS;
}
