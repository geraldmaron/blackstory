/**
 * Public beta disable controls: Vercel env keys and kill-switch ids.
 * Operators can return to static read-only without redeploying product code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_KILL_SWITCH_IDS } from '../kill-switches.js';

export const BETA_DISABLE_POLICY_VERSION = '1.0.0' as const;

/** Firestore Remote Config kill switch for immutable snapshot serving. */
export const PUBLIC_STATIC_MODE_SWITCH_ID = 'public-static-mode' as const;

/** Workloads stopped immediately when entering static read-only containment. */
export const BETA_DYNAMIC_WORKLOAD_SWITCHES = [
  'corrections-submissions',
  'search',
  'geocoding',
  'nearby-location',
] as const;

export const BETA_DISABLE_RUNBOOK_RELATIVE_PATH = 'docs/launch/disable-public-beta.md' as const;

export interface BetaDisableControl {
  readonly id: string;
  readonly mechanism: 'vercel-env' | 'firestore-kill-switch';
  readonly key: string;
  readonly description: string;
}

export const BETA_DISABLE_CONTROLS: readonly BetaDisableControl[] = [
  {
    id: 'public-static-mode',
    mechanism: 'firestore-kill-switch',
    key: PUBLIC_STATIC_MODE_SWITCH_ID,
    description: 'Engage public-static-mode in Firestore/Remote Config for corpus-wide read-only.',
  },
];

/**
 * Asserts the public-static-mode kill switch is registered for Vercel public web.
 * `repoRoot` is retained in the signature for compatibility with existing launch-gate callers.
 */
export function assertBetaDisableConfigKeys(_repoRoot: string): void {
  if (!(CORE_KILL_SWITCH_IDS as readonly string[]).includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    throw new Error('public-static-mode is not registered in CORE_KILL_SWITCH_IDS.');
  }
}

/** Asserts operator runbook for disabling public beta exists. */
export function assertBetaDisableConfigDocumented(repoRoot: string): void {
  const runbook = join(repoRoot, BETA_DISABLE_RUNBOOK_RELATIVE_PATH);
  if (!existsSync(runbook)) {
    throw new Error(`Missing disable runbook: ${BETA_DISABLE_RUNBOOK_RELATIVE_PATH}`);
  }
  const content = readFileSync(runbook, 'utf8');
  if (!content.includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    throw new Error('Disable runbook must document public-static-mode kill switch.');
  }
  if (!/Vercel/i.test(content)) {
    throw new Error('Disable runbook must document Vercel as the env flip host.');
  }
}
