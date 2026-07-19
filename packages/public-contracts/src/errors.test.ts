import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS,
  isClientVersionUnsupported,
  publicApiErrorEnvelopeSchema,
} from './errors.js';

test('round-trips a valid error envelope', () => {
  const input = {
    error: {
      code: 'NOT_FOUND',
      message: 'No entity with that id in the active release.',
      requestId: 'req_abc123',
    },
  };
  const parsed = publicApiErrorEnvelopeSchema.parse(input);
  assert.deepEqual(parsed, input);
});

test('CLIENT_VERSION_UNSUPPORTED pairs with 426 Upgrade Required', () => {
  assert.equal(CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS, 426);
  const envelope = publicApiErrorEnvelopeSchema.parse({
    error: { code: 'CLIENT_VERSION_UNSUPPORTED', message: 'Please update the app.' },
  });
  assert.equal(isClientVersionUnsupported(envelope), true);
});

test('rejects an unknown error code (adversarial: unknown enum value)', () => {
  assert.throws(() =>
    publicApiErrorEnvelopeSchema.parse({ error: { code: 'SOMETHING_MADE_UP', message: 'x' } }),
  );
});

test('rejects an oversized message (adversarial: maliciously large DTO)', () => {
  assert.throws(() =>
    publicApiErrorEnvelopeSchema.parse({ error: { code: 'INTERNAL', message: 'x'.repeat(5000) } }),
  );
});

test('strips unknown top-level fields (e.g. an accidental stack trace) rather than passing them through', () => {
  const parsed = publicApiErrorEnvelopeSchema.parse({
    error: { code: 'INTERNAL', message: 'boom' },
    stack: 'Error: boom\n    at internalHandler (/srv/app/handler.js:42:9)',
  } as unknown as Record<string, unknown>);
  assert.deepEqual(parsed, { error: { code: 'INTERNAL', message: 'boom' } });
  assert.ok(!('stack' in parsed));
});
