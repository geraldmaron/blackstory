/**
 * Bounded connection pool abstraction with fail-closed exhaustion (T-13 / BB-012).
 * Does not open real sockets; callers supply a client factory for runtime adapters.
 */
import { assertServerOnly } from './server-only.js';

export class PoolExhaustedError extends Error {
  constructor(message = 'Database connection pool exhausted') {
    super(message);
    this.name = 'PoolExhaustedError';
  }
}

export type PooledClient = {
  readonly id: string;
  readonly release: () => void;
};

export type ClientFactory = () => Promise<{ id: string; close: () => Promise<void> | void }>;

export type ConnectionPoolOptions = {
  readonly max: number;
  readonly acquireTimeoutMs: number;
  readonly createClient: ClientFactory;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
};

type InternalClient = {
  id: string;
  close: () => Promise<void> | void;
  inUse: boolean;
};

export class ConnectionPool {
  readonly #max: number;
  readonly #acquireTimeoutMs: number;
  readonly #createClient: ClientFactory;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #clients: InternalClient[] = [];
  #createInFlight = 0;

  constructor(options: ConnectionPoolOptions) {
    assertServerOnly('ConnectionPool');
    if (options.max < 1) {
      throw new Error('ConnectionPool max must be >= 1');
    }
    this.#max = options.max;
    this.#acquireTimeoutMs = options.acquireTimeoutMs;
    this.#createClient = options.createClient;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get size(): number {
    return this.#clients.length;
  }

  get inUseCount(): number {
    return this.#clients.filter((client) => client.inUse).length;
  }

  async acquire(): Promise<PooledClient> {
    const deadline = this.#now() + this.#acquireTimeoutMs;
    while (this.#now() <= deadline) {
      const idle = this.#clients.find((client) => !client.inUse);
      if (idle) {
        idle.inUse = true;
        return this.#wrap(idle);
      }

      if (this.#clients.length + this.#createInFlight < this.#max) {
        this.#createInFlight += 1;
        try {
          const created = await this.#createClient();
          const internal: InternalClient = { ...created, inUse: true };
          this.#clients.push(internal);
          return this.#wrap(internal);
        } finally {
          this.#createInFlight -= 1;
        }
      }

      await this.#sleep(10);
    }
    throw new PoolExhaustedError(
      `Timed out after ${this.#acquireTimeoutMs}ms waiting for a free connection (max=${this.#max})`,
    );
  }

  async drain(): Promise<void> {
    const closing = [...this.#clients];
    this.#clients.length = 0;
    await Promise.all(closing.map((client) => Promise.resolve(client.close())));
  }

  #wrap(client: InternalClient): PooledClient {
    let released = false;
    return {
      id: client.id,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        client.inUse = false;
      },
    };
  }
}

/**
 * Simulates concurrent acquire pressure for exhaustion tests without a live database.
 */
export async function simulateConnectionExhaustion(options: {
  readonly max: number;
  readonly acquireTimeoutMs: number;
  readonly concurrent: number;
}): Promise<{ acquired: number; exhausted: number }> {
  assertServerOnly('simulateConnectionExhaustion');
  let sequence = 0;
  const pool = new ConnectionPool({
    max: options.max,
    acquireTimeoutMs: options.acquireTimeoutMs,
    createClient: async () => {
      const id = `sim-${sequence++}`;
      return { id, close: () => undefined };
    },
    sleep: async () => undefined,
  });

  const held: PooledClient[] = [];
  let exhausted = 0;
  const tasks = Array.from({ length: options.concurrent }, async () => {
    try {
      const client = await pool.acquire();
      held.push(client);
    } catch (error) {
      if (error instanceof PoolExhaustedError) {
        exhausted += 1;
        return;
      }
      throw error;
    }
  });
  await Promise.all(tasks);
  for (const client of held) {
    client.release();
  }
  await pool.drain();
  return { acquired: held.length, exhausted };
}
