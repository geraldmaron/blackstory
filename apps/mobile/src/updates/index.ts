/**
 * EAS Update / OTA posture and controls (MOB-019, repo-ovn7). Public
 * surface — the rest of the app should import from here, not from
 * `native-bridge.ts` directly, mirroring `src/observability/index.ts` and
 * `src/security/index.ts`'s barrel convention.
 */
export {
  resolveUpdatesPosture,
  updatesPostureToAttributes,
  CODE_SIGNING_POSTURE,
} from './config';
export type { UpdatesPosture, ResolveUpdatesPostureInput } from './config';

export {
  getUpdatesPosture,
  checkForUpdate,
  fetchAndApplyUpdate,
} from './bootstrap';
export type { CheckForUpdateResult, ApplyUpdateResult } from './bootstrap';

export { loadNativeUpdates } from './native-bridge';
export type { NativeUpdatesSurface } from './native-bridge';
