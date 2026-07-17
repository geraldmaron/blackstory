/**
 * Adapter run health evaluation: record-count and schema drift → quarantine.
 */
import type { AdapterRunOutcome } from './types.js';

export const RUN_HEALTH_ISSUES = [
  'record_count_drift',
  'schema_version_drift',
  'null_field_spike',
  'missing_required_field',
] as const;

export type RunHealthIssue = (typeof RUN_HEALTH_ISSUES)[number];

export type EvaluateRunHealthInput = {
  readonly expectedCount: number;
  readonly actualCount: number;
  readonly countToleranceFraction?: number;
  readonly expectedSchemaVersion: string;
  readonly observedSchemaVersion: string;
  /** Observed null rate for a tracked field (0–1). */
  readonly nullFieldRate?: number;
  readonly maxNullFieldRate?: number;
  readonly missingRequiredFields?: readonly string[];
};

export type EvaluateRunHealthResult = {
  readonly outcome: Extract<AdapterRunOutcome, 'success' | 'quarantined'>;
  readonly issues: readonly RunHealthIssue[];
  readonly details: readonly string[];
};

function isCountWithinTolerance(
  expected: number,
  actual: number,
  toleranceFraction: number,
): boolean {
  if (expected === 0) {
    return actual === 0;
  }
  const delta = Math.abs(actual - expected) / expected;
  return delta <= toleranceFraction;
}

export function evaluateRunHealth(input: EvaluateRunHealthInput): EvaluateRunHealthResult {
  const issues: RunHealthIssue[] = [];
  const details: string[] = [];
  const tolerance = input.countToleranceFraction ?? 0.15;

  if (!isCountWithinTolerance(input.expectedCount, input.actualCount, tolerance)) {
    issues.push('record_count_drift');
    details.push(
      `Record count drift: expected ${input.expectedCount}, got ${input.actualCount} (tolerance ${tolerance})`,
    );
  }

  if (input.observedSchemaVersion !== input.expectedSchemaVersion) {
    issues.push('schema_version_drift');
    details.push(
      `Schema version drift: expected ${input.expectedSchemaVersion}, got ${input.observedSchemaVersion}`,
    );
  }

  if (
    input.nullFieldRate !== undefined &&
    input.maxNullFieldRate !== undefined &&
    input.nullFieldRate > input.maxNullFieldRate
  ) {
    issues.push('null_field_spike');
    details.push(
      `Null field rate ${input.nullFieldRate} exceeds max ${input.maxNullFieldRate}`,
    );
  }

  if (input.missingRequiredFields?.length) {
    issues.push('missing_required_field');
    details.push(`Missing required fields: ${input.missingRequiredFields.join(', ')}`);
  }

  return {
    outcome: issues.length ? 'quarantined' : 'success',
    issues,
    details,
  };
}

export function shouldQuarantineRun(result: EvaluateRunHealthResult): boolean {
  return result.outcome === 'quarantined';
}

export function shouldDeadLetterRun(
  consecutiveQuarantines: number,
  threshold = 3,
): boolean {
  return consecutiveQuarantines >= threshold;
}
