/**
 * Runtime guard that fails closed when database helpers execute in a browser-like global.
 */
export function assertServerOnly(context = '@black-book/data-access'): void {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
  };
  if (typeof globalObject.window !== 'undefined' || typeof globalObject.document !== 'undefined') {
    throw new Error(`${context} refused to run in a browser environment`);
  }
}
