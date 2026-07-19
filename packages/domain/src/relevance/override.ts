/**
 * Manual relevance override with required human reason.
 */
import type { RelevanceDecision } from '@repo/schemas';
import type { RelevanceOverride } from './types.js';

const MIN_OVERRIDE_REASON_LENGTH = 12;

export type ValidateOverrideInput = {
  readonly decision: RelevanceDecision;
  readonly reason: string;
  readonly overriddenBy: string;
  readonly overriddenAt: string;
};

export function assertOverrideReasonPresent(reason: string): void {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_OVERRIDE_REASON_LENGTH) {
    throw new Error(
      `Relevance override reason is required and must be at least ${MIN_OVERRIDE_REASON_LENGTH} characters.`,
    );
  }
}

export function validateRelevanceOverride(input: ValidateOverrideInput): RelevanceOverride {
  if (!input.overriddenBy.trim()) {
    throw new Error('Relevance override requires overriddenBy.');
  }
  if (!input.overriddenAt.trim()) {
    throw new Error('Relevance override requires overriddenAt.');
  }
  assertOverrideReasonPresent(input.reason);
  return {
    decision: input.decision,
    reason: input.reason.trim(),
    overriddenBy: input.overriddenBy.trim(),
    overriddenAt: input.overriddenAt.trim(),
  };
}

export function applyRelevanceOverride(
  baseDecision: RelevanceDecision,
  override?: RelevanceOverride,
): RelevanceDecision {
  return override?.decision ?? baseDecision;
}
