/**
 * Server request auth helper: picks firebase-session or layered mode and verifies the caller.
 */
import { getAuth } from 'firebase-admin/auth';
import { createServerFirebaseApp } from '@repo/firebase';
import {
  FirebaseSessionAuthorizationError,
  createFirebaseSessionAuthorizer,
} from './firebase-session-authorizer';
import { resolveAdminAuthMode } from './mode';
import {
  ServerAdminAuthorizationError,
  type AdminRequestHeaders,
  type VerifiedFirebaseAdminIdentity,
} from './server-authorization';

export type ResolvedAdminCaller = {
  readonly mode: 'firebase' | 'layered';
  readonly email: string;
  readonly uid: string;
  readonly admin: VerifiedFirebaseAdminIdentity;
};

function firebaseVerifierFromAdminSdk() {
  const { app } = createServerFirebaseApp(process.env);
  const auth = getAuth(app);
  return {
    async verifyIdToken(idToken: string, checkRevoked: true): Promise<VerifiedFirebaseAdminIdentity> {
      const decoded = await auth.verifyIdToken(idToken, checkRevoked);
      return decoded as VerifiedFirebaseAdminIdentity;
    },
  };
}

/**
 * Authorize an admin API/page request.
 * Firebase mode: verified Firebase ID token for a user that exists in Auth.
 * Layered mode: requires IAP + Firebase (IAP verifier not wired here yet — fail closed).
 */
export async function authorizeAdminRequest(
  headers: AdminRequestHeaders,
): Promise<ResolvedAdminCaller> {
  const mode = resolveAdminAuthMode();
  const firebaseVerifier = firebaseVerifierFromAdminSdk();

  if (mode === 'firebase') {
    const authorizer = createFirebaseSessionAuthorizer(firebaseVerifier);
    const identity = await authorizer.assertAuthenticated(headers);
    return {
      mode,
      email: identity.email,
      uid: identity.admin.uid,
      admin: identity.admin,
    };
  }

  const iapHeader =
    'get' in headers && typeof headers.get === 'function'
      ? headers.get('x-goog-iap-jwt-assertion')
      : (headers as Record<string, string | undefined>)['x-goog-iap-jwt-assertion'];

  if (!iapHeader) {
    throw new ServerAdminAuthorizationError(
      'IAP_ASSERTION_REQUIRED',
      'Layered admin auth requires a verified IAP assertion',
    );
  }

  throw new ServerAdminAuthorizationError(
    'IAP_ASSERTION_REQUIRED',
    'Layered IAP verifier is not wired in this runtime; use ADMIN_AUTH_MODE=firebase for local admin access',
  );
}

function describeAuthFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /quota project/i.test(message) ||
    /identitytoolkit\.googleapis\.com/i.test(message) ||
    /764086051850/.test(message)
  ) {
    return (
      'Firebase token verification needs a Google Cloud quota project for local ADC. ' +
      'Set GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf in apps/admin/.env.local ' +
      '(or: gcloud auth application-default set-quota-project black-book-efaaf), then restart admin.'
    );
  }
  return 'Unauthorized';
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof FirebaseSessionAuthorizationError) {
    return Response.json({ error: error.message, code: error.code }, { status: 403 });
  }
  if (error instanceof ServerAdminAuthorizationError) {
    const status =
      error.code === 'FIREBASE_ID_TOKEN_REQUIRED' || error.code === 'IAP_ASSERTION_REQUIRED'
        ? 401
        : 403;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error('admin auth failure', error);
  return Response.json({ error: describeAuthFailure(error) }, { status: 401 });
}
