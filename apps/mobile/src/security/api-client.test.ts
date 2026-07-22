import { createApiClient, CLIENT_VERSION_HEADER } from './api-client';

function makeFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status: 200, ok: true } as unknown as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('createApiClient — client version header attachment', () => {
  it('attaches X-BlackStory-Client on every request', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      fetch: fetchImpl,
    });

    await client.request('/v1/entity/abc');

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers[CLIENT_VERSION_HEADER]).toBe('mobile/1.0.0; api=1');
    expect(calls[0].url).toBe('https://api.blackbook.app/v1/entity/abc');
  });

  it('attaches the client header on every request in a session', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app',
      clientVersion: '1.0.0',
      apiMajor: 1,
      fetch: fetchImpl,
    });

    await client.request('/v1/entity/a');
    await client.request('/v1/search?q=x');
    await client.request('/v1/bootstrap');

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers[CLIENT_VERSION_HEADER]).toBe('mobile/1.0.0; api=1');
    }
  });

  it('preserves caller-supplied headers alongside the client header', async () => {
    const { fetchImpl, calls } = makeFetch();
    const client = createApiClient({
      baseUrl: 'https://api.blackbook.app/',
      clientVersion: '1.0.0',
      apiMajor: 1,
      fetch: fetchImpl,
    });

    await client.request('v1/entity/abc', {
      headers: { Accept: 'application/json' },
    });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers[CLIENT_VERSION_HEADER]).toBe('mobile/1.0.0; api=1');
    expect(calls[0].url).toBe('https://api.blackbook.app/v1/entity/abc');
  });
});
