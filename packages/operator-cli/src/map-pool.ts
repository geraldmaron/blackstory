/**
 * Bounded async worker pool for parallelizing independent subject/item work.
 * Preserves input order in the result array while capping in-flight tasks.
 */

export type MapPoolOptions = {
  readonly concurrency: number;
};

/**
 * Maps `items` through `worker` with at most `concurrency` concurrent workers.
 * Rejects if concurrency < 1. Individual worker rejections propagate immediately
 * (callers that want per-item isolation should catch inside the worker).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions,
): Promise<R[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency));
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
