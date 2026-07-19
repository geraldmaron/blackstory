/**
 * Firebase session authorizer for solo-operator admin access.
 * Verifies a Firebase ID token (revoked check on). Access control is who exists
 * in Firebase Authentication — no hardcoded email list in app code.
 * Does not replace layered IAP+claims+MFA for production `ADMIN_AUTH_MODE=layered`.
 */
import {
  AUTHORIZATION_HEADER,
  ServerAdminAuthorizationError,
  type AdminRequestHeaders,
  type FirebaseAdminTokenVerifier,
  type VerifiedFirebaseAdminIdentity,
} from './server-authorization';

export type FirebaseSessionAuthorizedAdmin = {
  readonly admin: VerifiedFirebaseAdminIdentity;
  readonly email: string;
};

function readHeader(headers: AdminRequestHeaders, name: string): string | undefined {
  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(name)?.trim() || undefined;
  }
  const values = headers as Readonly<Record<string, string | readonly string[] | undefined>>;
  const value = Object.entries(values).find(([candidate]) => candidate.toLowerCase() === name)?.[1];
  const first = typeof value === 'string' ? value : value?.[0];
  return first?.trim() || undefined;
}

function requireFirebaseIdToken(headers: AdminRequestHeaders): string {
  const authorization = readHeader(headers, AUTHORIZATION_HEADER);
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  if (!match?.[1]) {
    throw new ServerAdminAuthorizationError(
      'FIREBASE_ID_TOKEN_REQUIRED',
      'A Firebase bearer ID token is required',
    );
  }
  return match[1];
}

export class FirebaseSessionAuthorizationError extends Error {
  readonly code: 'ADMIN_EMAIL_REQUIRED' | 'ADMIN_SESSION_INVALID';

  constructor(code: FirebaseSessionAuthorizationError['code'], message: string) {
    super(message);
    this.name = 'FirebaseSessionAuthorizationError';
    this.code = code;
  }
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createFirebaseSessionAuthorizer(firebaseVerifier: FirebaseAdminTokenVerifier) {
  return {
    async assertAuthenticated(
      headers: AdminRequestHeaders,
    ): Promise<FirebaseSessionAuthorizedAdmin> {
      const idToken = requireFirebaseIdToken(headers);
      const admin = await firebaseVerifier.verifyIdToken(idToken, true);
      if (!admin.email) {
        throw new FirebaseSessionAuthorizationError(
          'ADMIN_EMAIL_REQUIRED',
          'Firebase administrator identity must include an email',
        );
      }
      return {
        admin,
        email: normalizeAdminEmail(admin.email),
      };
    },
  };
}
