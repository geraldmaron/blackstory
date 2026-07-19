/**
 * Bounded async worker pool for parallelizing independent subject/item work.
 * Preserves input order in the result array while capping in-flight tasks.
 */

export type MapPoolOptions<R = unknown> = {
  readonly concurrency: number;
  /** Called after each item finishes (order is completion order, not input order). */
  readonly onItemComplete?: (result: R, index: number, total: number) => void;
};

/**
 * Maps `items` through `worker` with at most `concurrency` concurrent workers.
 * Rejects if concurrency < 1. Individual worker rejections propagate immediately
 * (callers that want per-item isolation should catch inside the worker).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions<R>,
): Promise<R[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency));
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const total = items.length;
  const onItemComplete = options.onItemComplete;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const result = await worker(items[index]!, index);
      results[index] = result;
      onItemComplete?.(result, index, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
