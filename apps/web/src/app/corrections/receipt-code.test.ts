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

/**
 * The code and the sentence after it are separate elements. As two adjacent spans they ran
 * together in the flat text — "BB-COR-…Keep this." — so anything reading the page as text,
 * including some assistive-tech reading modes, got the next word stuck to the one thing a
 * person has to keep.
 */
test('the receipt code is its own element, not a span glued to the next sentence', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = (await import('react')).default;
  const { ReceiptBlock } = await import('./ReceiptBlock');
  const html = renderToStaticMarkup(
    React.createElement(ReceiptBlock, { receiptCode: 'BB-COR-TESTTESTTESTTEST' }),
  );
  assert.match(html, /<code class="ds-receipt__value">BB-COR-TESTTESTTESTTEST<\/code>/);
  assert.match(html, /<p class="ds-receipt__keep">/);
  assert.doesNotMatch(
    html,
    /BB-COR-TESTTESTTESTTEST<\/span><span/,
    'the code must not be a span immediately followed by another span',
  );
});
