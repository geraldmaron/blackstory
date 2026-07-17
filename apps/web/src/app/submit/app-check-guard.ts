/**
 * Server-only App Check verification for the public "submit a lead" route. Mirrors
 * `apps/api-submissions/src/app-check.ts` exactly same guard factory
 * (`createAppCheckGuard`), same verifier (`createFirebaseAppCheckVerifier`), same replay
 * protection posture so this public entry point enforces App Check identically to every
 * other public mutation surface instead of inventing a second policy. Never import this file
 * from a Client Component: it pulls in `@black-book/firebase`'s Admin SDK surface.
 *
 * The `@black-book/firebase` import below is a dynamic `import`, not a static one, on
 * purpose: `apps/web`'s package.json (like `apps/admin`'s) is CommonJS-rooted, while
 * `@black-book/firebase` is an ESM package whose module graph includes a top-level `await`
 * (`embeddings/backfill-cli.ts`). A static import forces the whole graph through a
 * CJS-compatible transform, which cannot represent that top-level `await` and fails to even
 * load. A dynamic `import` loads it through real ESM semantics instead, which is exactly
 * what CJS-to-ESM interop is.
 */
import type {
  AppCheckDecision,
  AppCheckGuardOptions,
  AppCheckHeaders,
  AppCheckTelemetry,
  AppCheckVerifier,
  EnvironmentLike,
} from '@black-book/firebase';

export type SubmitLeadAppCheckOptions = {
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

export type SubmitLeadAppCheckGuard = (request: {
  readonly headers: AppCheckHeaders;
}) => Promise<AppCheckDecision>;

export async function createSubmitLeadAppCheckGuard(
  options: SubmitLeadAppCheckOptions = {},
): Promise<SubmitLeadAppCheckGuard> {
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
    replayProtection: true,
  });
  return (request: { readonly headers: AppCheckHeaders }) => guard({ headers: request.headers });
}
