/**
 * Browser-only Supabase client init for the admin portal.
 * Uses the anon/publishable key only — never service_role on the client.
 *
 * Cookie-backed (createBrowserClient), not localStorage: middleware and server
 * components have to read the session too, otherwise page authorization can only
 * run after hydration and every server render is identity-blind.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  clientSingleton = createBrowserClient(url, anonKey);
  return clientSingleton;
}
