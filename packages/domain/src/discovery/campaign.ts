/**
 * Discovery campaign boundaries and budget enforcement (BB-039).
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type {
  DiscoveryCampaignBoundaries,
  DiscoveryCampaignBudget,
  DiscoveryCampaignConfig,
} from './types.js';
import { geographicHintWithinCountries, extractGeographicHints } from './geography.js';

export function assertCampaignBudgetValid(budget: DiscoveryCampaignBudget): void {
  if (budget.maxCandidates < 1) {
    throw new Error('Campaign maxCandidates must be at least 1');
  }
  if (budget.maxQuarantined < 0) {
    throw new Error('Campaign maxQuarantined must be non-negative');
  }
  if (budget.maxDeadLetter < 0) {
    throw new Error('Campaign maxDeadLetter must be non-negative');
  }
  if (budget.maxRetriesPerCandidate < 0) {
    throw new Error('Campaign maxRetriesPerCandidate must be non-negative');
  }
}

export function assertCampaignBoundariesValid(boundaries: DiscoveryCampaignBoundaries): void {
  if (boundaries.countries.length === 0) {
    throw new Error('Campaign boundaries require at least one country or global');
  }
}

export function createDiscoveryCampaignConfig(
  input: DiscoveryCampaignConfig,
): DiscoveryCampaignConfig {
  assertCampaignBudgetValid(input.budget);
  assertCampaignBoundariesValid(input.boundaries);
  return input;
}

export type CampaignBudgetSnapshot = {
  readonly accepted: number;
  readonly quarantined: number;
  readonly deadLetter: number;
  readonly totalProcessed: number;
};

export function isWithinCandidateBudget(
  snapshot: CampaignBudgetSnapshot,
  budget: DiscoveryCampaignBudget,
): boolean {
  return snapshot.totalProcessed < budget.maxCandidates;
}

export function isWithinQuarantineBudget(
  snapshot: CampaignBudgetSnapshot,
  budget: DiscoveryCampaignBudget,
): boolean {
  return snapshot.quarantined <= budget.maxQuarantined;
}

export function isWithinDeadLetterBudget(
  snapshot: CampaignBudgetSnapshot,
  budget: DiscoveryCampaignBudget,
): boolean {
  return snapshot.deadLetter <= budget.maxDeadLetter;
}

export function isWithinCampaignBudget(
  snapshot: CampaignBudgetSnapshot,
  budget: DiscoveryCampaignBudget,
): boolean {
  return (
    isWithinCandidateBudget(snapshot, budget) &&
    isWithinQuarantineBudget(snapshot, budget) &&
    isWithinDeadLetterBudget(snapshot, budget)
  );
}

export function recordWithinCampaignBoundaries(
  record: AdapterCandidateRecord,
  boundaries: DiscoveryCampaignBoundaries,
): boolean {
  if (boundaries.adapterIds && boundaries.adapterIds.length > 0) {
    if (!boundaries.adapterIds.includes(record.provenance.adapterId)) {
      return false;
    }
  }

  const hints = extractGeographicHints(record);
  return geographicHintWithinCountries(hints, boundaries.countries);
}
