/**
 * ShellHeader nav active-state helper coverage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isShellNavActive } from './ShellHeader.js';

describe('isShellNavActive', () => {
  it('matches home only on exact /', () => {
    assert.equal(isShellNavActive('/', '/'), true);
    assert.equal(isShellNavActive('/explore', '/'), false);
  });

  it('matches path prefixes for non-home items', () => {
    assert.equal(isShellNavActive('/search', '/search'), true);
    assert.equal(isShellNavActive('/search/results', '/search'), true);
    assert.equal(isShellNavActive('/explore', '/search'), false);
  });

  it('compares absolute http(s) hrefs by pathname', () => {
    assert.equal(isShellNavActive('/stories', 'https://example.com/stories'), true);
    assert.equal(isShellNavActive('/stories/a', 'https://example.com/stories'), true);
    assert.equal(isShellNavActive('/search', 'https://example.com/stories'), false);
  });
});
