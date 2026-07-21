/**
 * Browser-only Supabase client init for the admin portal.
 * Uses the anon/publishable key only — never service_role on the client.
 */
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy apps/admin/.env.example to .env.local and set Supabase auth vars.',
    );
  }
  return { url: url.trim(), anonKey: anonKey.trim() };
}

let clientSingleton: SupabaseClient | undefined;

export function getAdminSupabaseClient(): SupabaseClient {
  if (clientSingleton) return clientSingleton;
  const { url, anonKey } = readPublicSupabaseConfig();
  clientSingleton = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return clientSingleton;
}
