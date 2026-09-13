/**
 * The two things about this module that are easy to get wrong and expensive to get wrong.
 *
 * 1. `connectWithDeadline` must not release the client it hands back. An earlier draft attached
 *    the late-release handler in a `finally` that could not tell "the race was won by connect"
 *    from "the race was won by the timer", so the success path released the connection the caller
 *    was still holding — a use-after-release that would have surfaced as random query failures
 *    under load, which is exactly the condition this function exists for.
 * 2. It must release a client that arrives AFTER the deadline. Dropping it on the floor leaks a
 *    connection with nobody to return it, which is the same exhaustion the deadline is diagnosing,
 *    one level down.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectWithDeadline, normalizePgConnectionString } from './pg-connection.ts';

function fakePool(delayMs: number) {
  const released: number[] = [];
  let n = 0;
  return {
    released,
    connect: () =>
      new Promise<{ id: number; release: () => void }>((resolve) => {
        const id = ++n;
        setTimeout(() => resolve({ id, release: () => released.push(id) }), delayMs);
      }),
  };
}

test('a client acquired inside the deadline is returned and NOT released', async () => {
  const pool = fakePool(5);
  const client = await connectWithDeadline(pool, 500);
  assert.equal(client.id, 1);
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(pool.released, [], 'the caller still holds this client');
});

test('the deadline fires with an actionable message when the acquire stalls', async () => {
  const pool = fakePool(10_000);
  await assert.rejects(
    () => connectWithDeadline(pool, 20),
    (err: Error) => {
      assert.match(err.message, /Timed out after 20ms acquiring a Postgres connection/);
      assert.match(err.message, /connectionTimeoutMillis does not catch/);
      return true;
    },
  );
});

test('a client that arrives after the deadline is released rather than leaked', async () => {
  const pool = fakePool(40);
  await assert.rejects(() => connectWithDeadline(pool, 10));
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(pool.released, [1], 'the late connection went back to the pool');
});

test('config carries bounds, not pg defaults, and honors env overrides', () => {
  const cfg = normalizePgConnectionString('postgresql://u:p@db.example.supabase.co:5432/postgres');
  assert.equal(cfg.max, 4, 'not pg’s default of 10');
  assert.ok(cfg.connectionTimeoutMillis > 0);
  assert.ok(cfg.idleTimeoutMillis > 0);
  assert.ok(cfg.query_timeout > 0);
  assert.match(cfg.options, /statement_timeout=\d+/);
  assert.match(cfg.options, /idle_in_transaction_session_timeout=\d+/);
  assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
  assert.match(cfg.connectionString, /uselibpqcompat=true/);
  assert.match(cfg.connectionString, /sslmode=require/);

  process.env.PGPOOL_MAX = '9';
  try {
    assert.equal(normalizePgConnectionString('postgresql://u:p@db.x.supabase.co:5432/d').max, 9);
  } finally {
    delete process.env.PGPOOL_MAX;
  }
});

test('a non-Supabase connection string is left alone and gets no ssl override', () => {
  const cfg = normalizePgConnectionString('postgresql://u:p@localhost:5432/postgres');
  assert.equal(cfg.ssl, undefined);
  assert.equal(cfg.connectionString, 'postgresql://u:p@localhost:5432/postgres');
  assert.equal(cfg.max, 4, 'the bounds still apply');
});
