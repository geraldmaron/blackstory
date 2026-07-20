/**
 * Receipt-code derivation, digest-lookup, and comparison tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReceiptCode, digestReceiptCode, receiptCodesMatch } from './receipt-code.ts';

const PEPPER = 'test-only-pepper';

test('createReceiptCode produces the stable BB-COR-<16 hex> wire shape', () => {
  const code = createReceiptCode('submission-1', PEPPER);
  assert.match(code, /^BB-COR-[A-F0-9]{16}$/);
});

test('createReceiptCode is deterministic for the same id+pepper and differs across ids', () => {
  const a = createReceiptCode('submission-1', PEPPER);
  const again = createReceiptCode('submission-1', PEPPER);
  const b = createReceiptCode('submission-2', PEPPER);
  assert.equal(a, again);
  assert.notEqual(a, b);
});

test('createReceiptCode differs across peppers for the same id (no cross-surface reuse)', () => {
  const a = createReceiptCode('submission-1', PEPPER);
  const b = createReceiptCode('submission-1', 'a-different-pepper');
  assert.notEqual(a, b);
});

test('digestReceiptCode round-trips a code minted by createReceiptCode', () => {
  const code = createReceiptCode('submission-1', PEPPER);
  const digest = digestReceiptCode(code, PEPPER);
  assert.ok(digest);
  assert.equal(digest, digestReceiptCode(code, PEPPER));
});

test('digestReceiptCode rejects a code that does not match the wire shape (no store round-trip)', () => {
  assert.equal(digestReceiptCode('not-a-receipt', PEPPER), undefined);
  assert.equal(digestReceiptCode('BB-COR-short', PEPPER), undefined);
  assert.equal(digestReceiptCode('bb-cor-0123456789abcdef', PEPPER), undefined);
});

test('receiptCodesMatch is true only for identical strings', () => {
  assert.equal(receiptCodesMatch('BB-COR-0000000000000000', 'BB-COR-0000000000000000'), true);
  assert.equal(receiptCodesMatch('BB-COR-0000000000000000', 'BB-COR-0000000000000001'), false);
  assert.equal(receiptCodesMatch('short', 'BB-COR-0000000000000000'), false);
});
