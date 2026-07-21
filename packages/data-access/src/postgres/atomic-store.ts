/**
 * Postgres-backed AtomicStore compatible with commitWithAudit path mutations.
 * Runs each runTransaction in a single SQL transaction against bb_* tables.
 */
import type pg from 'pg';
import type { AtomicStore, AtomicTransaction } from './audit-outbox.js';
import { applyPostgresDocumentMutation, readPostgresDocument } from './path-write.js';
import { getOpsPostgresPool } from './pool.js';

type PendingWrite = {
  readonly path: string;
  readonly data: Readonly<Record<string, unknown>>;
};

export function createPostgresAtomicStore(pool: pg.Pool = getOpsPostgresPool()): AtomicStore {
  return {
    async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const pending: PendingWrite[] = [];
      try {
        await client.query('BEGIN');
        const transaction: AtomicTransaction = {
          async get(path: string) {
            return readPostgresDocument(client, path);
          },
          create(path, data) {
            pending.push({ path, data });
          },
          set(path, data) {
            pending.push({ path, data });
          },
          update(path, data) {
            pending.push({ path, data });
          },
        };
        const result = await operation(transaction);
        for (const write of pending) {
          await applyPostgresDocumentMutation(client, write.path, write.data);
        }
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Builds the live AtomicStore for operator-cli / admin commits from env. */
export async function createLiveAtomicStoreFromEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<AtomicStore> {
  return createPostgresAtomicStore(getOpsPostgresPool(environment));
}
