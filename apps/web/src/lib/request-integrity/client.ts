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

/** Forgets this tab's token, so the next request asks the server for the current one. */
export function clearRequestIntegrityToken(): void {
  cached = undefined;
}

/** The integrity guard's own refusal (`server.ts`): 401 for a missing or mismatched token. */
async function isIntegrityRefusal(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  const body = (await response
    .clone()
    .json()
    .catch(() => undefined)) as { readonly error?: unknown } | undefined;
  return body?.error === 'request_integrity_required';
}

/**
 * Fetches with the integrity header. When the server refuses the token itself (the shared cookie
 * expired or was replaced under this tab), it fetches the current token and sends once more.
 * Never retried for any other answer, and never more than once.
 *
 * Every caller goes through here, reads included: the route no longer renews the cookie on
 * reuse, so this tab's cached token can outlive the cookie by up to half an hour.
 */
export async function fetchWithRequestIntegrity(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = async () =>
    fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(await getRequestIntegrityHeaders()),
      },
    });
  const response = await send();
  if (!(await isIntegrityRefusal(response))) return response;
  clearRequestIntegrityToken();
  return send();
}

export function postJsonWithRequestIntegrity(url: string, payload: unknown): Promise<Response> {
  return fetchWithRequestIntegrity(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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
