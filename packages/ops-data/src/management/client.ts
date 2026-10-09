/** Remote clients carry no database or publication credentials. */
export type ManagementClient = (path: string, body?: unknown) => Promise<unknown>;
export function remoteManagementClient(
  baseUrl: string,
  token: () => Promise<string>,
  fetcher: typeof fetch = fetch,
): ManagementClient {
  const base = new URL(baseUrl);
  if (
    !['https:', 'http:'].includes(base.protocol) ||
    (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))
  )
    throw new Error('Management API requires HTTPS');
  return async (path, body) => {
    const response = await fetcher(
      new URL(
        path.startsWith('/source-library?')
          ? `/admin/api/sources/library${path.slice('/source-library'.length)}`
          : `/admin/api/work${path}`,
        base,
      ),
      {
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    const value = (await response.json()) as { error?: unknown };
    if (!response.ok)
      throw new Error(
        typeof value.error === 'string'
          ? value.error
          : `Management API returned ${response.status}`,
      );
    return value;
  };
}
