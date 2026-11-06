/**
 * The root-layout fallback renders its own document, offers retry and home, and never prints the
 * raw message, stack or digest.
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import GlobalError from './global-error';

void React;

test('Global error fallback is a standalone document with retry and a plain home link', () => {
  const error = Object.assign(new Error('secret connection string at db.internal'), {
    digest: 'ref987',
    stack: 'Error: boom\n    at run (/srv/app/server.js:10:5)',
  });
  const html = renderToStaticMarkup(<GlobalError error={error} reset={() => {}} />);
  assert.match(html, /^<html lang="en">/);
  assert.match(html, /<body[^>]*>/);
  assert.match(html, /<h1[^>]*>Something went wrong<\/h1>/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Try again<\/button>/);
  assert.match(html, /<a[^>]*href="\/"[^>]*>Back to home<\/a>/);
  assert.doesNotMatch(html, /secret connection string|db\.internal|ref987|server\.js/);
});
