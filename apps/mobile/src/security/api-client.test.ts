import {
  createApiClient,
  APP_CHECK_HEADER,
  CLIENT_VERSION_HEADER,
} from './api-client';

function makeFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status: 200, ok: true } as unknown as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('createApiClient — App Check token attachment', () => {
  it('attaches the App Check token under the exact header the server reads', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      getToken: async () => 'attestation-jwt',
      fetch: fetchImpl,
    });

    await client.request('/v1/entity/abc');

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers[APP_CHECK_HEADER]).toBe('attestation-jwt');
    expect(headers[CLIENT_VERSION_HEADER]).toBe('mobile/1.0.0; api=1');
    expect(calls[0].url).toBe('https://api.blackbook.app/v1/entity/abc');
  });

  it('attempts a token fetch on EVERY request — never silently omitted', async () => {
    const { fetchImpl } = makeFetch();
    const getToken = jest.fn(async () => 'attestation-jwt');
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      getToken,
      fetch: fetchImpl,
    });

    await client.request('/v1/entity/a');
    await client.request('/v1/search?q=x');
    await client.request('/v1/bootstrap');

    expect(getToken).toHaveBeenCalledTimes(3);
  });

  it('fails OPEN for the client: still sends the request (unattested) when no token is available', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      getToken: async () => null, // App Check unavailable / not initialized
      fetch: fetchImpl,
    });

    const response = await client.request('/v1/entity/abc');

    expect(response.status).toBe(200);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers[APP_CHECK_HEADER]).toBeUndefined();
    // The version-floor header is always present, token or not.
    expect(headers[CLIENT_VERSION_HEADER]).toBe('mobile/1.0.0; api=1');
  });

  it('honours forceRefreshToken by passing it through to the token provider', async () => {
    const { fetchImpl } = makeFetch();
    const getToken = jest.fn(async () => 'attestation-jwt');
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      getToken,
      fetch: fetchImpl,
    });

    await client.request('/v1/search?q=x', { forceRefreshToken: true });
    expect(getToken).toHaveBeenCalledWith(true);
  });

  it('preserves caller-supplied headers alongside the security headers', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app/',
      clientVersion: '1.0.0',
      apiMajor: 1,
      getToken: async () => 'attestation-jwt',
      fetch: fetchImpl,
    });

    await client.request('v1/entity/abc', {
      headers: { Accept: 'application/json' },
    });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers[APP_CHECK_HEADER]).toBe('attestation-jwt');
    // Trailing slash on base + no leading slash on path still joins cleanly.
    expect(calls[0].url).toBe('https://api.blackbook.app/v1/entity/abc');
  });
});
