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
        'Copy apps/web/.env.example to apps/web/.env.local and set the Supabase/ADMIN_* vars.',
    );
  }
  return { url: url.trim(), anonKey: anonKey.trim() };
}

let clientSingleton: SupabaseClient | undefined;

const ADMIN_AUTH_ENDPOINTS = new Set(['token', 'user', 'logout']);

/** Keep the configured Supabase URL for its session cookie key, but use a same-origin
 * transport for the browser Auth calls. Server clients still call Supabase directly. */
export function adminAuthRequestUrl(input: RequestInfo | URL, supabaseUrl: string): string | null {
  const requestUrl = new URL(input instanceof Request ? input.url : String(input));
  const upstream = new URL(supabaseUrl);
  if (requestUrl.origin !== upstream.origin) return null;
  const prefix = `${upstream.pathname.replace(/\/$/, '')}/auth/v1/`;
  if (!requestUrl.pathname.startsWith(prefix)) return null;
  const endpoint = requestUrl.pathname.slice(prefix.length);
  if (!ADMIN_AUTH_ENDPOINTS.has(endpoint)) return null;
  return `/api/admin-auth/${endpoint}${requestUrl.search}`;
}

function adminAuthFetch(supabaseUrl: string): typeof fetch {
  return (input, init) => {
    const proxyUrl = adminAuthRequestUrl(input, supabaseUrl);
    if (!proxyUrl) return fetch(input, init);
    const request =
      input instanceof Request ? new Request(new URL(proxyUrl, location.origin), input) : proxyUrl;
    return fetch(request, init);
  };
}

export function getAdminSupabaseClient(): SupabaseClient {
  if (clientSingleton) return clientSingleton;
  const { url, anonKey } = readPublicSupabaseConfig();
  clientSingleton = createBrowserClient(url, anonKey, { global: { fetch: adminAuthFetch(url) } });
  return clientSingleton;
}
