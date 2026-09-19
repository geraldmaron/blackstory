import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('root layout request-renders nonce-bearing framework scripts without becoming async', () => {
  const source = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  assert.match(source, /export const dynamic = ['"]force-dynamic['"]/u);
  assert.doesNotMatch(source, /export default async function/u);
});
