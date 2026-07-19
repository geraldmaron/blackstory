/**
 * Browser Firebase Auth helpers for the admin portal (email + password).
 * Client session is UX only — APIs still verify the ID token server-side.
 * Access is granted to any non-disabled Firebase Auth user that can sign in;
 * provision operators in the Firebase Console (no hardcoded email list).
 */
'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getAdminClientAuth } from './firebase-browser';

export function subscribeAdminAuth(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAdminClientAuth(), listener);
}

function formatAuthError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  const message = error.message || 'Sign-in failed';

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return new Error('Email or password is incorrect.');
  }
  if (code === 'auth/user-disabled') {
    return new Error('This administrator account is disabled.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many sign-in attempts. Wait a moment and try again.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      'Email/password sign-in is not enabled for this Firebase project. ' +
        'Enable Email/Password under Authentication → Sign-in method.',
    );
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return new Error(
      `Origin "${host}" is not authorized. Use http://localhost:3001/login (not 127.0.0.1).`,
    );
  }
  return new Error(code ? `${message} (${code})` : message);
}

async function assertSessionUser(user: User): Promise<User> {
  if (!user.email) {
    await signOut(getAdminClientAuth());
    throw new Error('Administrator accounts must have an email address.');
  }
  return user;
}

/**
 * Sign in with email and password for a Firebase Auth user.
 */
export async function signInAdminWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getAdminClientAuth();
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return assertSessionUser(result.user);
  } catch (error) {
    throw formatAuthError(error);
  }
}

export async function signOutAdmin(): Promise<void> {
  await signOut(getAdminClientAuth());
}

export async function getAdminIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getAdminClientAuth();
  const user = auth.currentUser;
  if (!user?.email) {
    if (user) await signOut(auth);
    return null;
  }
  return user.getIdToken(forceRefresh);
}
