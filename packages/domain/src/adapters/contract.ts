/**
 * Source adapter contract validation (BB-037).
 */
import { assertEvidenceSourceValid } from '../provenance/source.js';
import type { GeographicCoverage, RateLimitPolicy, SourceAdapterContract, VolumeExpectation } from './types.js';

export function assertRateLimitPolicyValid(policy: RateLimitPolicy): void {
  if (!Number.isFinite(policy.requestsPerMinute) || policy.requestsPerMinute <= 0) {
    throw new Error('rateLimits.requestsPerMinute must be a positive number');
  }
  if (policy.burst !== undefined && (!Number.isFinite(policy.burst) || policy.burst <= 0)) {
    throw new Error('rateLimits.burst must be a positive number when set');
  }
}

export function assertVolumeExpectationValid(volume: VolumeExpectation): void {
  if (!Number.isFinite(volume.expectedRecordsPerRun) || volume.expectedRecordsPerRun < 0) {
    throw new Error('volume.expectedRecordsPerRun must be a non-negative number');
  }
  if (
    !Number.isFinite(volume.countToleranceFraction) ||
    volume.countToleranceFraction < 0 ||
    volume.countToleranceFraction > 1
  ) {
    throw new Error('volume.countToleranceFraction must be between 0 and 1');
  }
}

export function assertGeographicCoverageValid(coverage: GeographicCoverage): void {
  if (!coverage.countries.length) {
    throw new Error('geographicCoverage.countries must be non-empty');
  }
  for (const code of coverage.countries) {
    const normalized = code.trim();
    if (!normalized) {
      throw new Error('geographicCoverage countries must be non-empty strings');
    }
    if (normalized !== 'global' && !/^[A-Z]{2}$/.test(normalized)) {
      throw new Error(`geographicCoverage country code must be global or ISO alpha-2: ${code}`);
    }
  }
}

export function assertSourceAdapterContractValid(contract: SourceAdapterContract): void {
  if (!contract.adapterId.trim()) {
    throw new Error('adapterId is required');
  }
  if (!contract.parserVersion.trim()) {
    throw new Error('parserVersion is required');
  }
  if (!contract.expectedSchemaVersion.trim()) {
    throw new Error('expectedSchemaVersion is required');
  }
  if (!contract.permittedClaimClasses.length) {
    throw new Error('permittedClaimClasses must be non-empty');
  }
  if (
    contract.canarySampleFraction !== undefined &&
    (contract.canarySampleFraction <= 0 || contract.canarySampleFraction > 1)
  ) {
    throw new Error('canarySampleFraction must be in (0, 1] when set');
  }
  assertEvidenceSourceValid({
    classification: contract.classification,
    policy: contract.policy,
  });
  assertRateLimitPolicyValid(contract.rateLimits);
  assertVolumeExpectationValid(contract.volume);
  assertGeographicCoverageValid(contract.geographicCoverage);
}
