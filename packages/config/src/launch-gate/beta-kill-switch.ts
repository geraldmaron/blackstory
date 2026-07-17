
/**
 * public beta disable controls App Hosting env keys and kill-switch ids.
 * Operators can return to static read-only without redeploying product code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_KILL_SWITCH_IDS } from '../kill-switches.js';

export const BETA_DISABLE_POLICY_VERSION = '1.0.0' as const;

/** App Hosting Next.js runtime flag when "1", serves snapshot read-only shell. */
export const PUBLIC_READ_API_DISABLED_ENV = 'PUBLIC_READ_API_DISABLED' as const;

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
  readonly mechanism: 'app-hosting-env' | 'firestore-kill-switch';
  readonly key: string;
  readonly description: string;
}

export const BETA_DISABLE_CONTROLS: readonly BetaDisableControl[] = [
  {
    id: 'public-read-api-disabled',
    mechanism: 'app-hosting-env',
    key: PUBLIC_READ_API_DISABLED_ENV,
    description: 'Fast App Hosting env flip — snapshot banner + no dynamic public APIs.',
  },
  {
    id: 'public-static-mode',
    mechanism: 'firestore-kill-switch',
    key: PUBLIC_STATIC_MODE_SWITCH_ID,
    description: 'Engage public-static-mode in Firestore/Remote Config for corpus-wide read-only.',
  },
];

export interface AppHostingEnvProbe {
  readonly file: string;
  readonly variable: string;
  readonly expectedDefault?: string;
}

export const APP_HOSTING_PUBLIC_READ_PROBES: readonly AppHostingEnvProbe[] = [
  { file: 'apps/web/apphosting.yaml', variable: PUBLIC_READ_API_DISABLED_ENV, expectedDefault: '0' },
  {
    file: 'apps/web/apphosting.production.yaml',
    variable: PUBLIC_READ_API_DISABLED_ENV,
    expectedDefault: '0',
  },
  {
    file: 'apps/web/apphosting.staging.yaml',
    variable: PUBLIC_READ_API_DISABLED_ENV,
    expectedDefault: '0',
  },
];

function readText(repoRoot: string, relativePath: string): string {
  const absolute = join(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return readFileSync(absolute, 'utf8');
}

/** Asserts App Hosting templates declare PUBLIC_READ_API_DISABLED (default off). */
export function assertBetaDisableConfigKeys(repoRoot: string): void {
  if (!(CORE_KILL_SWITCH_IDS as readonly string[]).includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    throw new Error('public-static-mode is not registered in CORE_KILL_SWITCH_IDS.');
  }

  for (const probe of APP_HOSTING_PUBLIC_READ_PROBES) {
    const content = readText(repoRoot, probe.file);
    if (!content.includes(`variable: ${probe.variable}`)) {
      throw new Error(`${probe.file} does not declare ${probe.variable}.`);
    }
    if (probe.expectedDefault !== undefined && !content.includes(`value: '${probe.expectedDefault}'`)) {
      throw new Error(`${probe.file} does not default ${probe.variable} to ${probe.expectedDefault}.`);
    }
  }
}

/** Asserts operator runbook for disabling public beta exists. */
export function assertBetaDisableConfigDocumented(repoRoot: string): void {
  const runbook = join(repoRoot, BETA_DISABLE_RUNBOOK_RELATIVE_PATH);
  if (!existsSync(runbook)) {
    throw new Error(`Missing disable runbook: ${BETA_DISABLE_RUNBOOK_RELATIVE_PATH}`);
  }
  const content = readFileSync(runbook, 'utf8');
  if (!content.includes(PUBLIC_READ_API_DISABLED_ENV)) {
    throw new Error('Disable runbook must document PUBLIC_READ_API_DISABLED.');
  }
  if (!content.includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    throw new Error('Disable runbook must document public-static-mode kill switch.');
  }
}
