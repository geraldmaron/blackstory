/**
 * Server-only App Check verification for the public `/locate` geocode route. Mirrors
 * `apps/web/src/app/search/api/app-check-guard.ts` (itself a mirror of
 * `apps/web/src/app/submit/app-check-guard.ts`) so this endpoint enforces App Check through the
 * same guard factory (`createAppCheckGuard`), verifier (`createFirebaseAppCheckVerifier`), and
 * telemetry sink as every other public surface, instead of inventing a second policy. Never
 * import this file from a Client Component: it pulls in `@black-book/firebase`'s Admin SDK
 * surface.
 *
 * Same read-endpoint deviation as the search guard: `replayProtection` is `false`. This is a
 * GET/read endpoint (address/ZIP/coordinate lookup, never a write), and a browser legitimately
 * issues several idempotent lookups in quick succession (typing an address, retrying a location
 * permission prompt) single-use token consumption would reject those as replays. The token is
 * still cryptographically verified either way.
 *
 * The `@black-book/firebase` import below is a dynamic `import`, not a static one, for the same
 * CJS/ESM interop reason documented in `../../search/api/app-check-guard.ts`.
 */
import type {
  AppCheckDecision,
  AppCheckGuardOptions,
  AppCheckHeaders,
  AppCheckTelemetry,
  AppCheckVerifier,
  EnvironmentLike,
} from '@black-book/firebase';

export type LocateAppCheckOptions = {
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

export type LocateAppCheckGuard = (request: {
  readonly headers: AppCheckHeaders;
}) => Promise<AppCheckDecision>;

export async function createLocateAppCheckGuard(
  options: LocateAppCheckOptions = {},
): Promise<LocateAppCheckGuard> {
  const {
    createAppCheckGuard,
    createFirebaseAppCheckVerifier,
    createServerFirebaseApp,
    parseAppCheckMode,
  } = await import('@black-book/firebase');

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
