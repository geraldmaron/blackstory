import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoBrowserDatabaseCredentials } from './index.ts';

test('database credentials cannot use browser-exposed environment variables', () => {
  for (const key of ['NEXT_PUBLIC_DATABASE_URL', 'NEXT_PUBLIC_POSTGRES_URL']) {
    assert.throws(() => assertNoBrowserDatabaseCredentials({ [key]: 'postgresql://secret' }));
  }
});
