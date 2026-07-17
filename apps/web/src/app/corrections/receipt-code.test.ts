/**
 * Unit tests for opaque receipt codes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReceiptCode, digestReceiptCode, receiptCodesMatch } from './receipt-code';

const PEPPER = 'test-pepper';

test('creates stable receipt codes for a submission id', () => {
  const code = createReceiptCode('sub-123', PEPPER);
  assert.match(code, /^BB-COR-[A-F0-9]{16}$/);
  assert.equal(createReceiptCode('sub-123', PEPPER), code);
  assert.notEqual(createReceiptCode('sub-456', PEPPER), code);
});

test('digests receipt codes for lookup without exposing raw ids', () => {
  const code = createReceiptCode('sub-123', PEPPER);
  const digest = digestReceiptCode(code, PEPPER);
  assert.ok(digest);
  assert.equal(digestReceiptCode('BB-COR-NOTVALID9999999', PEPPER), undefined);
});

test('compares receipt codes in constant time', () => {
  const code = createReceiptCode('sub-123', PEPPER);
  assert.equal(receiptCodesMatch(code, code), true);
  assert.equal(receiptCodesMatch(code, `${code.slice(0, -1)}0`), false);
});
