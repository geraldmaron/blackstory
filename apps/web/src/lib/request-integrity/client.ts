'use client';

const REQUEST_INTEGRITY_ENDPOINT = '/api/request-integrity';
const REQUEST_INTEGRITY_HEADER = 'x-csrf-token';
const REFRESH_AFTER_MS = 45 * 60 * 1000;

let cached: { readonly token: string; readonly issuedAt: number } | undefined;
let inFlight: Promise<string | undefined> | undefined;

async function fetchToken(): Promise<string | undefined> {
  try {
    const response = await fetch(REQUEST_INTEGRITY_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { readonly token?: unknown };
    if (typeof payload.token !== 'string' || payload.token.length < 32) return undefined;
    cached = { token: payload.token, issuedAt: Date.now() };
    return payload.token;
  } catch {
    return undefined;
  }
}

export async function getRequestIntegrityHeaders(): Promise<Readonly<Record<string, string>>> {
  if (cached && Date.now() - cached.issuedAt < REFRESH_AFTER_MS) {
    return { [REQUEST_INTEGRITY_HEADER]: cached.token };
  }
  inFlight ??= fetchToken().finally(() => {
    inFlight = undefined;
  });
  const token = await inFlight;
  return token ? { [REQUEST_INTEGRITY_HEADER]: token } : {};
}
