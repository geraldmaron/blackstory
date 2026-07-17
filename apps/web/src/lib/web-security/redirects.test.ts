/**
 * Safe redirect unit tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSafeRedirect, isSafeRedirect, UnsafeRedirectError } from './redirects';

test('assertSafeRedirect allows same-site relative paths', () => {
  assert.equal(assertSafeRedirect('/search'), '/search');
  assert.equal(assertSafeRedirect('/entity/ent_123?q=1'), '/entity/ent_123?q=1');
});

test('assertSafeRedirect rejects protocol-relative URLs', () => {
  assert.throws(() => assertSafeRedirect('//evil.example/phish'), UnsafeRedirectError);
});

test('assertSafeRedirect rejects javascript and data schemes', () => {
  assert.throws(() => assertSafeRedirect('javascript:alert(1)'), UnsafeRedirectError);
  assert.throws(() => assertSafeRedirect('data:text/html,<script>alert(1)</script>'), UnsafeRedirectError);
});

test('assertSafeRedirect rejects backslash paths', () => {
  assert.throws(() => assertSafeRedirect('/\\evil.example'), UnsafeRedirectError);
});

test('assertSafeRedirect rejects off-site absolute URLs without allowlist', () => {
  assert.throws(() => assertSafeRedirect('https://evil.example/'), UnsafeRedirectError);
});

test('assertSafeRedirect allows same-origin absolute when configured', () => {
  const result = assertSafeRedirect('https://blackbook.example/search', {
    allowedOrigin: 'https://blackbook.example',
  });
  assert.equal(result, '/search');
});

test('isSafeRedirect mirrors assertSafeRedirect', () => {
  assert.equal(isSafeRedirect('/about'), true);
  assert.equal(isSafeRedirect('//evil.example'), false);
});
