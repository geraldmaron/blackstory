/** Supabase Auth helpers for the browser admin session. */
'use client';

import type { AdminSessionUser } from './session-user';
import {
  getSupabaseAdminAccessToken,
  signInSupabaseAdminWithEmailPassword,
  signOutSupabaseAdmin,
  subscribeSupabaseAdminAuth,
} from './supabase-client-auth';

export function subscribeAdminAuth(listener: (user: AdminSessionUser | null) => void): () => void {
  return subscribeSupabaseAdminAuth(listener);
}

export async function signInAdminWithEmailPassword(email: string, password: string): Promise<AdminSessionUser> {
  return signInSupabaseAdminWithEmailPassword(email, password);
}

export async function signOutAdmin(): Promise<void> {
  await signOutSupabaseAdmin();
}

export async function getAdminIdToken(forceRefresh = false): Promise<string | null> {
  return getSupabaseAdminAccessToken(forceRefresh);
}
