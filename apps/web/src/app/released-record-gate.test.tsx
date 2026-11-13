/**
 * The record-room gate answers 404 for a slug with no released record, before any skeleton
 * streams, and passes a real record through untouched.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReleasedRecordGate, releasedRecordExists } from './released-record-gate';

const params = (slug: string) => Promise.resolve({ slug });

function isNotFound(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.includes('404');
}

test('a slug with no released record throws notFound from the gate', async () => {
  await assert.rejects(
    ReleasedRecordGate({ children: 'room', params: params('zzz-no-such-place') }),
    isNotFound,
  );
});

test('a malformed slug is gated without a lookup', async () => {
  assert.equal(await releasedRecordExists('../../etc/passwd'), false);
  await assert.rejects(
    ReleasedRecordGate({ children: 'room', params: params('../../etc/passwd') }),
    isNotFound,
  );
});

test('a released record passes through to its room', async () => {
  const children = await ReleasedRecordGate({
    children: 'room',
    params: params('fifteenth-street-presbyterian-church'),
  });
  assert.equal(children, 'room');
});
