/**
 * Local barrel for BB-063 launch-gate kill-switch configuration hooks.
 */
export {
  APP_HOSTING_PUBLIC_READ_PROBES,
  BETA_DISABLE_CONTROLS,
  BETA_DISABLE_POLICY_VERSION,
  BETA_DISABLE_RUNBOOK_RELATIVE_PATH,
  BETA_DYNAMIC_WORKLOAD_SWITCHES,
  PUBLIC_READ_API_DISABLED_ENV,
  PUBLIC_STATIC_MODE_SWITCH_ID,
  assertBetaDisableConfigDocumented,
  assertBetaDisableConfigKeys,
} from './beta-kill-switch.js';
export type { AppHostingEnvProbe, BetaDisableControl } from './beta-kill-switch.js';
