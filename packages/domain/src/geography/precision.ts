/**
 * Public location precision helpers aligned with constitution publicPrecisionRules (BB-014).
 */
import { evaluatePublicPrecision, loadProductConstitution } from '@black-book/schemas';
import type { LivingStatus } from '../living.js';

export type PublicPrecisionLevel = string;

/** Allowed public precision levels from the active constitution. */
export function allowedPublicPrecisionLevels(): readonly string[] {
  return loadProductConstitution().publicPrecisionRules.allowedLevels;
}

/** Prohibited public precision levels from the active constitution. */
export function prohibitedPublicPrecisionLevels(): readonly string[] {
  return loadProductConstitution().publicPrecisionRules.prohibitedLevels;
}

/**
 * Evaluate whether a precision level may appear on public projections.
 * Living residential / street / unit are rejected when livingStatus treats as living.
 */
export function assertPublicPrecisionAllowed(
  precision: PublicPrecisionLevel,
  options: { livingStatus?: LivingStatus } = {},
): void {
  const result = evaluatePublicPrecision(
    precision,
    options.livingStatus === undefined ? {} : { livingStatus: options.livingStatus },
  );
  if (!result.allowed) {
    throw new Error(`Public precision not allowed: ${precision} (${result.reason ?? 'denied'})`);
  }
}

export function isPublicPrecisionAllowed(
  precision: PublicPrecisionLevel,
  options: { livingStatus?: LivingStatus } = {},
): boolean {
  return evaluatePublicPrecision(
    precision,
    options.livingStatus === undefined ? {} : { livingStatus: options.livingStatus },
  ).allowed;
}
