/**
 * Public beta disable controls: Vercel env keys and kill-switch ids.
 * Operators can return to static read-only without redeploying product code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_KILL_SWITCH_IDS } from '../kill-switches.js';

export const BETA_DISABLE_POLICY_VERSION = '1.0.0' as const;

/** Runtime flag when "1", serves snapshot read-only shell (set on Vercel + redeploy). */
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

/** Documented default for public beta (off) — asserted via runbook + .env.example. */
export const PUBLIC_READ_API_DISABLED_DEFAULT = '0' as const;

export interface BetaDisableControl {
  readonly id: string;
  readonly mechanism: 'vercel-env' | 'firestore-kill-switch';
  readonly key: string;
  readonly description: string;
}

export const BETA_DISABLE_CONTROLS: readonly BetaDisableControl[] = [
  {
    id: 'public-read-api-disabled',
    mechanism: 'vercel-env',
    key: PUBLIC_READ_API_DISABLED_ENV,
    description: 'Fast Vercel env flip — snapshot banner + no dynamic public APIs.',
  },
  {
    id: 'public-static-mode',
    mechanism: 'firestore-kill-switch',
    key: PUBLIC_STATIC_MODE_SWITCH_ID,
    description: 'Engage public-static-mode in Firestore/Remote Config for corpus-wide read-only.',
  },
];

/** @deprecated Use BETA_DISABLE_CONTROLS; retained name for import compatibility. */
export type AppHostingEnvProbe = {
  readonly file: string;
  readonly variable: string;
  readonly expectedDefault?: string;
};

/** Probes that document PUBLIC_READ_API_DISABLED for launch-gate machine checks. */
export const APP_HOSTING_PUBLIC_READ_PROBES: readonly AppHostingEnvProbe[] = [
  {
    file: BETA_DISABLE_RUNBOOK_RELATIVE_PATH,
    variable: PUBLIC_READ_API_DISABLED_ENV,
    expectedDefault: PUBLIC_READ_API_DISABLED_DEFAULT,
  },
  {
    file: '.env.example',
    variable: PUBLIC_READ_API_DISABLED_ENV,
    expectedDefault: PUBLIC_READ_API_DISABLED_DEFAULT,
  },
];

function readText(repoRoot: string, relativePath: string): string {
  const absolute = join(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return readFileSync(absolute, 'utf8');
}

/** Asserts docs declare PUBLIC_READ_API_DISABLED (default off) for Vercel public web. */
export function assertBetaDisableConfigKeys(repoRoot: string): void {
  if (!(CORE_KILL_SWITCH_IDS as readonly string[]).includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    throw new Error('public-static-mode is not registered in CORE_KILL_SWITCH_IDS.');
  }

  for (const probe of APP_HOSTING_PUBLIC_READ_PROBES) {
    const content = readText(repoRoot, probe.file);
    if (!content.includes(probe.variable)) {
      throw new Error(`${probe.file} does not declare ${probe.variable}.`);
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
  if (!/Vercel/i.test(content)) {
    throw new Error('Disable runbook must document Vercel as the env flip host.');
  }
}
