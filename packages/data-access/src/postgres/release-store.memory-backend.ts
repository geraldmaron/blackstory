/**
 * In-memory Postgres release-store backend for unit tests (no live DB).
 */
import type {
  PostgresReleaseStoreBackend,
  PostgresReleaseStoreTransaction,
} from './release-store.js';

type Operation =
  | {
      readonly kind: 'upsert';
      readonly key: string;
      readonly payload: Readonly<Record<string, unknown>>;
    }
  | { readonly kind: 'delete'; readonly key: string };

export class MemoryPostgresReleaseStoreBackend implements PostgresReleaseStoreBackend {
  private rows = new Map<string, Readonly<Record<string, unknown>>>();

  seed(key: string, payload: Readonly<Record<string, unknown>>): void {
    this.rows.set(key, structuredClone(payload));
  }

  read(key: string): Promise<Readonly<Record<string, unknown>> | undefined> {
    const value = this.rows.get(key);
    return Promise.resolve(value ? structuredClone(value) : undefined);
  }

  listKeys(prefix: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.rows.keys()].filter((key) => key.startsWith(prefix)).sort(),
    );
  }

  delete(key: string): Promise<void> {
    this.rows.delete(key);
    return Promise.resolve();
  }

  async runTransaction<T>(
    operation: (transaction: PostgresReleaseStoreTransaction) => Promise<T>,
  ): Promise<T> {
    const operations: Operation[] = [];
    const transaction: PostgresReleaseStoreTransaction = {
      get: async (key) => {
        const value = this.rows.get(key);
        return value ? structuredClone(value) : undefined;
      },
      upsert(key, payload) {
        operations.push({ kind: 'upsert', key, payload: structuredClone(payload) });
      },
      delete(key) {
        operations.push({ kind: 'delete', key });
      },
    };

    const result = await operation(transaction);
    const next = new Map(this.rows);
    for (const staged of operations) {
      if (staged.kind === 'delete') {
        next.delete(staged.key);
      } else {
        next.set(staged.key, staged.payload);
      }
    }
    this.rows = next;
    return result;
  }
}
