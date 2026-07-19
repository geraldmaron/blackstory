/**
 * Server-only App Check verification for the public corrections routes. Mirrors
 * `apps/web/src/app/submit/app-check-guard.ts` same guard factory and verifier posture.
 */
import type {
  AppCheckDecision,
  AppCheckGuardOptions,
  AppCheckHeaders,
  AppCheckTelemetry,
  AppCheckVerifier,
  EnvironmentLike,
} from '@repo/firebase';

export type CorrectionAppCheckOptions = {
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

export type CorrectionAppCheckGuard = (request: {
  readonly headers: AppCheckHeaders;
}) => Promise<AppCheckDecision>;

export async function createCorrectionAppCheckGuard(
  options: CorrectionAppCheckOptions = {},
): Promise<CorrectionAppCheckGuard> {
  const {
    createAppCheckGuard,
    createFirebaseAppCheckVerifier,
    createServerFirebaseApp,
    parseAppCheckMode,
  } = await import('@repo/firebase');

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
