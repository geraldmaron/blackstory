/**
 * Decides when `apps/api-public` should bind its `PublicDataAccess` port to live Firestore public
 * release projections instead of the injected in-memory adapter.
 *
 * Deliberately mirrors `apps/web/src/lib/public-data/live-policy.ts`'s gate (same env var
 * vocabulary: `PUBLIC_READ_API_DISABLED`, `PUBLIC_DATA_SOURCE`, `FIREBASE_PROJECT_ID` /
 * `GOOGLE_CLOUD_PROJECT`, and `@repo/firebase`'s `PRODUCTION_BREAK_GLASS_ENV` break-glass flag) so
 * an operator learns ONE production/local convention across both surfaces rather than two. This
 * function is a pure pre-check — it never touches Firestore — so callers can cleanly choose the
 * fixture adapter instead of calling into `@repo/firebase`'s `getServerFirestore`, which would
 * otherwise throw via `assertFirebaseProjectAllowed` for the same "not production-safe" cases this
 * gate is designed to detect first.
 */
import {
  hasEmulatorSignals,
  PRODUCTION_BREAK_GLASS_ENV,
  PRODUCTION_PROJECT_ID,
  type EnvironmentLike,
} from '@repo/firebase';

/**
 * `true` only when every one of the following holds:
 * - The public read API is not explicitly disabled (`PUBLIC_READ_API_DISABLED`).
 * - The caller has not forced the fixture/in-memory source (`PUBLIC_DATA_SOURCE=fixtures|seed`).
 * - No Firebase emulator signal is present (emulator runs always use the injected/fixture data).
 * - The resolved Firebase project is the production project (`black-book-efaaf`), or the caller
 *   explicitly opts in via `PUBLIC_DATA_SOURCE=firestore`.
 * - Either `NODE_ENV`/`BLACK_BOOK_ENV` is `production`, or the explicit break-glass flag
 *   (`BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1`) is set — this is what makes a documented LOCAL run
 *   against live production Firestore possible (see `http/README.md`'s run command).
 */
export function shouldUsePublicFirestoreDataAccess(
  environment: EnvironmentLike = process.env,
): boolean {
  if (
    environment.PUBLIC_READ_API_DISABLED === '1' ||
    environment.PUBLIC_READ_API_DISABLED === 'true'
  ) {
    return false;
  }
  if (
    environment.PUBLIC_DATA_SOURCE === 'fixtures' ||
    environment.PUBLIC_DATA_SOURCE === 'seed'
  ) {
    return false;
  }
  if (hasEmulatorSignals(environment)) {
    return false;
  }

  const projectId =
    environment.FIREBASE_PROJECT_ID?.trim() || environment.GOOGLE_CLOUD_PROJECT?.trim();
  if (projectId !== PRODUCTION_PROJECT_ID && environment.PUBLIC_DATA_SOURCE !== 'firestore') {
    return false;
  }

  const nodeEnv = environment.NODE_ENV ?? environment.BLACK_BOOK_ENV ?? 'development';
  if (nodeEnv !== 'production' && environment[PRODUCTION_BREAK_GLASS_ENV] !== '1') {
    return false;
  }

  return true;
}
