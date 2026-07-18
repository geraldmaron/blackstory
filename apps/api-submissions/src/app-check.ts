/**
 * Creates the App Check verification boundary for every submissions request,
 * enabling Admin SDK replay consumption for this security-critical mutation path.
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
