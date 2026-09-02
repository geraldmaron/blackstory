/**
 * Collapses concurrent loads of the same key onto one in-flight promise.
 * Prevents N cold-start requests from each pulling a multi-MB catalog from Postgres/CDN.
 */
export function createSingleFlight(): <T>(key: string, load: () => Promise<T>) => Promise<T> {
  const inFlight = new Map<string, Promise<unknown>>();

  return function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;
    const started = load().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, started);
    return started;
  };
}
