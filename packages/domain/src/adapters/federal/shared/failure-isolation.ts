/**
 * Failure isolation for federal adapter runs.
 * Run failures quarantine or dead-letter without touching public publication state.
 */
import { evaluateRunHealth } from '../../run-health.js';
import type { AdapterRunContext, AdapterRunOutcome } from '../../types.js';
import type { IsolatedFederalRunResult } from './types.js';
import type { FederalParseResult } from './types.js';

export type BuildIsolatedRunInput = {
  readonly context: AdapterRunContext;
  readonly parseResult?: FederalParseResult;
  readonly error?: unknown;
  readonly completedAt: string;
  readonly consecutiveQuarantines?: number;
  readonly deadLetterThreshold?: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Wrap adapter output so failures route to quarantine/dead-letter only.
 * Publication serving is never mutated by adapter run outcomes.
 */
export function buildIsolatedFederalRunResult(input: BuildIsolatedRunInput): IsolatedFederalRunResult {
  const { context, completedAt } = input;
  const adapterId = context.registryEntry.contract.adapterId;
  const { expectedRecordsPerRun, countToleranceFraction } = context.registryEntry.contract.volume;
  const expectedSchemaVersion = context.registryEntry.contract.expectedSchemaVersion;

  if (input.error) {
    return {
      adapterId,
      runId: context.runId,
      outcome: 'dead_letter',
      candidateCount: 0,
      issues: [`adapter_error:${errorMessage(input.error)}`],
      completedAt,
      publicationImpact: 'none',
      candidates: [],
    };
  }

  const parseResult = input.parseResult ?? { candidates: [], rejected: [], filteredExportCount: 0 };
  const actualCount = parseResult.candidates.length;
  const health = evaluateRunHealth({
    expectedCount: expectedRecordsPerRun,
    actualCount,
    countToleranceFraction,
    expectedSchemaVersion,
    observedSchemaVersion: expectedSchemaVersion,
  });

  let outcome: AdapterRunOutcome = health.outcome;
  const issues = [...health.details];

  if (parseResult.rejected.length > 0) {
    issues.push(`retention_rejected:${parseResult.rejected.length}`);
  }
  if (parseResult.filteredExportCount > 0) {
    issues.push(`large_export_filtered:${parseResult.filteredExportCount}`);
  }

  const threshold = input.deadLetterThreshold ?? 3;
  const consecutive = input.consecutiveQuarantines ?? 0;
  if (outcome === 'quarantined' && consecutive + 1 >= threshold) {
    outcome = 'dead_letter';
    issues.push('consecutive_quarantine_threshold_exceeded');
  }

  return {
    adapterId,
    runId: context.runId,
    outcome,
    candidateCount: actualCount,
    issues,
    completedAt,
    publicationImpact: 'none',
    candidates: outcome === 'success' ? parseResult.candidates : [],
  };
}
