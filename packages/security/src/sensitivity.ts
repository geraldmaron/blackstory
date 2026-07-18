
/**
 * Sensitivity vocabulary and precision-tier model for Black Book.
 *
 * The product constitution (@repo/schemas) is the authoritative policy source
 * for sensitivity classes, precision-reduction reasons, residential precision levels,
 * and residential public-precision caps. This module surfaces that policy as typed
 * read-only vocabularies used by the central redaction serialization layer.
 */
import { loadProductConstitution } from '@repo/schemas';


/**
 * Precision tiers for a located fact. Evidence and internal tiers may hold exact
 * residential precision; only the public tier is ever serialized to public surfaces
 * and it is always reduced through {@link reducePublicPrecision}.
 */
export type PrecisionTier = 'evidence' | 'internal' | 'public';

export type SensitivityClass = string;

export type PrecisionReductionReason = string;

/** Sensitivity classes from the active constitution (`none`, `living_residence`, …). */
export function sensitivityClasses(): readonly SensitivityClass[] {
  return loadProductConstitution().sensitivityRules.classes;
}

/** Recognized precision-reduction reasons from the active constitution. */
export function precisionReductionReasons(): readonly PrecisionReductionReason[] {
  return loadProductConstitution().sensitivityRules.precisionReductionReasons;
}

/** Precision levels that describe a residence and must never publish for living people. */
export function residentialPrecisionLevels(): readonly string[] {
  return loadProductConstitution().sensitivityRules.residentialPrecisionLevels;
}

/** Whether a precision level identifies a residence (street/unit/parcel/exact/residence). */
export function isResidentialPrecision(precision: string): boolean {
  return residentialPrecisionLevels().includes(precision);
}

/** Assert a sensitivity class token is recognized by the active constitution. */
export function assertSensitivityClass(value: string): void {
  if (!sensitivityClasses().includes(value)) {
    throw new Error(`Unknown sensitivity class: ${value}`);
  }
}
