/**
 * Browser Supabase Auth helpers for the admin portal (email + password).
 * Client session is UX only — APIs still verify the access token server-side.
 */
'use client';

import { getAdminSupabaseClient } from './supabase-browser';
import type { AdminSessionUser } from './session-user';

function formatSupabaseAuthError(error: { readonly message?: string }): Error {
  const message = error.message?.trim() || 'Sign-in failed';
  if (/invalid login credentials/i.test(message)) {
    return new Error('Email or password is incorrect.');
  }
  if (/email not confirmed/i.test(message)) {
    return new Error('Confirm your email before signing in.');
  }
  if (/too many requests/i.test(message)) {
    return new Error('Too many sign-in attempts. Wait a moment and try again.');
  }
  return new Error(message);
}

function toSessionUser(user: {
  id: string;
  email?: string | null;
}): AdminSessionUser | null {
  if (!user.email) return null;
  return { uid: user.id, email: user.email };
}

export function subscribeSupabaseAdminAuth(
  listener: (user: AdminSessionUser | null) => void,
): () => void {
  const client = getAdminSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    listener(session?.user ? toSessionUser(session.user) : null);
  });
  return () => subscription.unsubscribe();
}

export async function signInSupabaseAdminWithEmailPassword(
  email: string,
  password: string,
): Promise<AdminSessionUser> {
  const client = getAdminSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw formatSupabaseAuthError(error);
  }
  const sessionUser = data.user ? toSessionUser(data.user) : null;
  if (!sessionUser) {
    await client.auth.signOut();
    throw new Error('Administrator accounts must have an email address.');
  }
  return sessionUser;
}

export async function signOutSupabaseAdmin(): Promise<void> {
  await getAdminSupabaseClient().auth.signOut();
}

export async function getSupabaseAdminAccessToken(forceRefresh = false): Promise<string | null> {
  const client = getAdminSupabaseClient();
  if (forceRefresh) {
    const { data, error } = await client.auth.refreshSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  }
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
