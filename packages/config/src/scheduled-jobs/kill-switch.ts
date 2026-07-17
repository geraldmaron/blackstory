/**
 * Scheduled jobs reuse BB-035's existing kill-switch mechanism verbatim (packages/config/src/
 * kill-switches.ts) rather than inventing a parallel one. Discovery-campaign jobs reuse the
 * core 'research-campaigns' switch directly (exact semantic fit — see KILL_SWITCH_DEFINITIONS).
 * Every other job mints its own switch id through the same templated-id generator BB-035 already
 * uses for source adapters (`source-adapter-{id}`); the fail-closed, missing-flag-denies-by-
 * default evaluation in evaluateKillSwitch applies identically regardless of what the id names.
 */
import { sourceAdapterKillSwitchId, type KillSwitchId } from '../kill-switches.js';

/** Mints a job-scoped kill switch id using BB-035's existing templated-id scheme. */
export function scheduledJobKillSwitchId(jobId: string): KillSwitchId {
  return sourceAdapterKillSwitchId(jobId);
}
