/**
 * Creates the App Check verification boundary for submissions requests.
 *
 * @deprecated Prefer `createSubmissionsApiClientAttestationGuard` — Firebase App Check
 * retired for mobile corrections after ADR-020. Kept for rollback tooling only.
 */
import {
  createAppCheckGuard,
  createFirebaseAppCheckVerifier,
  createServerFirebaseApp,
  parseAppCheckMode,
  type AppCheckGuardOptions,
  type AppCheckHeaders,
  type AppCheckTelemetry,
  type AppCheckVerifier,
  type EnvironmentLike,
} from '@repo/firebase';

export type SubmissionsApiAppCheckOptions = {
  readonly environment?: EnvironmentLike;
  readonly mode?: AppCheckGuardOptions['mode'];
  readonly verifier?: AppCheckVerifier;
  readonly telemetry?: AppCheckTelemetry;
};

const consoleTelemetry: AppCheckTelemetry = {
  record(event) {
    console.info(JSON.stringify(event));
  },
};

/** @deprecated Use `createSubmissionsApiClientAttestationGuard`. */
export function createSubmissionsApiAppCheckGuard(options: SubmissionsApiAppCheckOptions = {}) {
  const environment = options.environment ?? process.env;
  const mode = options.mode ?? parseAppCheckMode(environment.APP_CHECK_MODE);
  const verifier =
    options.verifier ?? createFirebaseAppCheckVerifier(createServerFirebaseApp(environment).app);

  const guard = createAppCheckGuard({
    mode,
    verifier,
    telemetry: options.telemetry ?? consoleTelemetry,
    replayProtection: true,
  });
  return (request: { readonly headers: AppCheckHeaders }) => guard({ headers: request.headers });
}
