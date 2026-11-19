import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEmail, isHttpsUrl } from './validators';

test('a source has to be a full https address', () => {
  assert.equal(isHttpsUrl('https://www.loc.gov/item/123'), true);
  assert.equal(isHttpsUrl('http://www.loc.gov/item/123'), false);
  assert.equal(isHttpsUrl('www.loc.gov/item/123'), false);
  assert.equal(isHttpsUrl('https://localhost'), false);
});

test('an email needs an @ and a dotted domain', () => {
  assert.equal(isEmail('reader@example.org'), true);
  assert.equal(isEmail('reader@example'), false);
  assert.equal(isEmail('reader example.org'), false);
});
