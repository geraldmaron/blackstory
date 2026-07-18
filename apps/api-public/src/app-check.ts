/**
 * Creates the App Check verification boundary for every public API request,
 * defaulting to metrics-only rollout with token-safe telemetry.
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
} from '@blap/firebase';

export type PublicApiAppCheckOptions = {
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

export function createPublicApiAppCheckGuard(options: PublicApiAppCheckOptions = {}) {
  const environment = options.environment ?? process.env;
  const mode = options.mode ?? parseAppCheckMode(environment.APP_CHECK_MODE);
  const verifier =
    options.verifier ?? createFirebaseAppCheckVerifier(createServerFirebaseApp(environment).app);

  const guard = createAppCheckGuard({
    mode,
    verifier,
    telemetry: options.telemetry ?? consoleTelemetry,
    replayProtection: false,
  });
  return (request: { readonly headers: AppCheckHeaders }) => guard({ headers: request.headers });
}
