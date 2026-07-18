/**
 * Server-only App Check verification for the public search route. Mirrors
 * `apps/web/src/app/submit/app-check-guard.ts` (itself a mirror of
 * `apps/api-submissions/src/app-check.ts`) so this public read endpoint enforces App Check
 * through the same guard factory (`createAppCheckGuard`), verifier
 * (`createFirebaseAppCheckVerifier`), and telemetry sink as every other public surface, instead
 * of inventing a second policy. Never import this file from a Client Component: it pulls in
 * `@blap/firebase`'s Admin SDK surface.
 *
 * Deliberate deviation from the submit guard: `replayProtection` is `false` here. App Check
 * replay protection consumes a single-use token (each token is accepted at most once). That is
 * correct for a mutation like `submit` a replayed create is a duplicate write but wrong for a
 * GET/read search endpoint, where a browser legitimately issues many idempotent requests
 * (typeahead, pagination, back/forward) in quick succession. Enabling replay protection here would
 * reject those as replays. Reads carry no write side effect, so single-use enforcement buys no
 * safety and breaks normal usage; the token is still cryptographically verified, just not consumed.
 *
 * The `@blap/firebase` import below is a dynamic `import`, not a static one, on purpose:
 * `apps/web`'s package.json (like `apps/admin`'s) is CommonJS-rooted, while `@blap/firebase`
 * is an ESM package whose module graph includes a top-level `await`
 * (`embeddings/backfill-cli.ts`). A static import forces the whole graph through a CJS-compatible
 * transform, which cannot represent that top-level `await` and fails to even load. A dynamic
 * `import` loads it through real ESM semantics instead, which is exactly what CJS-to-ESM interop
 * is.
 */
import type {
  AppCheckDecision,
  AppCheckGuardOptions,
  AppCheckHeaders,
  AppCheckTelemetry,
  AppCheckVerifier,
  EnvironmentLike,
} from '@blap/firebase';

export type SearchAppCheckOptions = {
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

export type SearchAppCheckGuard = (request: {
  readonly headers: AppCheckHeaders;
}) => Promise<AppCheckDecision>;

export async function createSearchAppCheckGuard(
  options: SearchAppCheckOptions = {},
): Promise<SearchAppCheckGuard> {
  const {
    createAppCheckGuard,
    createFirebaseAppCheckVerifier,
    createServerFirebaseApp,
    parseAppCheckMode,
  } = await import('@blap/firebase');

  const environment = options.environment ?? process.env;
  const mode = options.mode ?? parseAppCheckMode(environment.APP_CHECK_MODE);
  const verifier =
    options.verifier ?? createFirebaseAppCheckVerifier(createServerFirebaseApp(environment).app);

  const guard = createAppCheckGuard({
    mode,
    verifier,
    telemetry: options.telemetry ?? consoleTelemetry,
    // See the file header: a read endpoint must not consume single-use tokens.
    replayProtection: false,
  });
  return (request: { readonly headers: AppCheckHeaders }) => guard({ headers: request.headers });
}
