/**
 * Fail-closed adapter run gates (BB-037). No adapter runs without approved source policy.
 */
import {
  assertSourceAdapterCanCreateCandidates,
  canSourceAdapterCreateCandidates,
  type SourceKillSwitchState,
} from '../provenance/source.js';
import type { SourceRegistryEntry } from './types.js';

const RUNNABLE_REGISTRY_STATES = new Set<SourceRegistryEntry['registryState']>(['approved', 'canary']);

export function canAdapterRun(
  entry: SourceRegistryEntry,
  killSwitch?: SourceKillSwitchState | null,
): boolean {
  if (!RUNNABLE_REGISTRY_STATES.has(entry.registryState)) {
    return false;
  }
  if (!entry.approvedAt || !entry.approvedBy) {
    return false;
  }
  return canSourceAdapterCreateCandidates(entry.evidenceSource, killSwitch);
}

/**
 * Fail-closed gate: adapter runs require approved policy and an enabled evidence source.
 */
export function assertAdapterMayRun(
  entry: SourceRegistryEntry,
  killSwitch?: SourceKillSwitchState | null,
): void {
  if (!RUNNABLE_REGISTRY_STATES.has(entry.registryState)) {
    throw new Error(
      `Source adapter "${entry.contract.adapterId}" cannot run in registry state "${entry.registryState}"`,
    );
  }
  if (!entry.approvedAt || !entry.approvedBy) {
    throw new Error(
      `Source adapter "${entry.contract.adapterId}" has no approved source policy`,
    );
  }
  assertSourceAdapterCanCreateCandidates(entry.evidenceSource, killSwitch);
}

export function isCanaryMode(entry: SourceRegistryEntry): boolean {
  return entry.registryState === 'canary';
}

/**
 * Apply canary sampling: when in canary mode, only a fraction of records proceed.
 * Returns indices of records that should be processed in this run.
 */
export function selectCanaryRecordIndices(
  totalRecords: number,
  sampleFraction: number,
): readonly number[] {
  if (totalRecords <= 0) {
    return [];
  }
  if (sampleFraction <= 0 || sampleFraction > 1) {
    throw new Error('canary sampleFraction must be in (0, 1]');
  }
  const target = Math.max(1, Math.ceil(totalRecords * sampleFraction));
  const step = totalRecords / target;
  const indices: number[] = [];
  for (let i = 0; i < target; i += 1) {
    indices.push(Math.min(totalRecords - 1, Math.floor(i * step)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}
