/**
 * Retry, quarantine, and dead-letter handling for discovery candidates.
 */
import type {
  DiscoveryCandidateRecord,
  DiscoveryFailureOutcome,
  DiscoveryQuarantineRecord,
} from './types.js';

export type HandleCandidateFailureInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly reason: string;
  readonly now: string;
};

export type HandleCandidateFailureResult = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly quarantine?: DiscoveryQuarantineRecord;
};

export function shouldRetryCandidate(
  candidate: DiscoveryCandidateRecord,
  maxRetries: number,
): boolean {
  return candidate.retryCount < maxRetries;
}

export function resolveFailureOutcome(
  candidate: DiscoveryCandidateRecord,
  maxRetries: number,
): DiscoveryFailureOutcome {
  if (shouldRetryCandidate(candidate, maxRetries)) {
    return 'retry';
  }
  if (candidate.retryCount >= maxRetries + 1) {
    return 'dead_letter';
  }
  return 'quarantine';
}

export function handleCandidateFailure(
  input: HandleCandidateFailureInput,
  maxRetries: number,
): HandleCandidateFailureResult {
  const outcome = resolveFailureOutcome(input.candidate, maxRetries);
  const nextRetryCount =
    outcome === 'retry' ? input.candidate.retryCount + 1 : input.candidate.retryCount;

  let status: DiscoveryCandidateRecord['status'];
  if (outcome === 'retry') {
    status = 'pending';
  } else if (outcome === 'dead_letter') {
    status = 'dead_letter';
  } else {
    status = 'quarantined';
  }

  const updated: DiscoveryCandidateRecord = {
    ...input.candidate,
    status,
    failureOutcome: outcome,
    failureReason: input.reason,
    retryCount: nextRetryCount,
    updatedAt: input.now,
  };

  const quarantine: DiscoveryQuarantineRecord | undefined =
    outcome === 'retry'
      ? undefined
      : {
          candidateId: updated.id,
          reason: input.reason,
          outcome,
          retryCount: nextRetryCount,
          recordedAt: input.now,
        };

  return {
    candidate: updated,
    ...(quarantine !== undefined ? { quarantine } : {}),
  };
}

export function quarantineCandidate(
  candidate: DiscoveryCandidateRecord,
  reason: string,
  now: string,
): DiscoveryCandidateRecord {
  return {
    ...candidate,
    status: 'quarantined',
    failureOutcome: 'quarantine',
    failureReason: reason,
    updatedAt: now,
  };
}

export function deadLetterCandidate(
  candidate: DiscoveryCandidateRecord,
  reason: string,
  now: string,
): DiscoveryCandidateRecord {
  return {
    ...candidate,
    status: 'dead_letter',
    failureOutcome: 'dead_letter',
    failureReason: reason,
    updatedAt: now,
  };
}

/** Whether campaign should continue after a candidate failure (continue-on-quarantine). */
export function shouldContinueCampaign(
  continueOnQuarantine: boolean,
  quarantinedCount: number,
  maxQuarantined: number,
): boolean {
  if (!continueOnQuarantine) {
    return quarantinedCount <= maxQuarantined;
  }
  return quarantinedCount < maxQuarantined;
}

export function shouldStopForDeadLetters(deadLetterCount: number, maxDeadLetter: number): boolean {
  return deadLetterCount >= maxDeadLetter;
}
