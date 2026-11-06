/**
 * The staff error boundary stays inside the staff shell: its own retry, a way back to the operations
 * desk rather than the public home, and no raw message or stack in production. Synthetic errors
 * only; no session, desk data or action is involved.
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import AdminError from './error';

void React;

function render(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(<AdminError error={error} reset={() => {}} />);
}

test('Staff desks get staff copy, a retry and a way back to the operations desk', () => {
  const html = render(new Error('anything'));
  assert.match(html, /<main[^>]*id="main"/);
  assert.match(html, /<h1>This desk could not load<\/h1>/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Try again<\/button>/);
  assert.match(html, /<a[^>]*href="\/admin"[^>]*>Back to the operations desk<\/a>/);
  assert.doesNotMatch(html, /public shell|Back to home|href="\/"/);
});

test('The staff boundary never prints the raw message or stack in production', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  process.env.NEXT_PUBLIC_APP_ENV = 'production';
  try {
    const error = Object.assign(new Error('secret connection string at db.internal'), {
      digest: 'ref987',
      stack: 'Error: boom\n    at run (/srv/app/server.js:10:5)',
    });
    const html = render(error);
    assert.match(html, /Reference ref987/);
    assert.doesNotMatch(html, /secret connection string|db\.internal|server\.js/);
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = prior;
  }
});

test('The staff boundary drops the stack even outside production', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  try {
    const error = Object.assign(
      new Error('Desk query failed\n    at run (/srv/app/server.js:10:5)'),
      {
        stack: 'Error: boom\n    at run (/srv/app/server.js:10:5)',
      },
    );
    const html = render(error);
    assert.match(html, /Desk query failed/);
    assert.doesNotMatch(html, /server\.js|\bat run\b/);
  } finally {
    if (prior !== undefined) process.env.NEXT_PUBLIC_APP_ENV = prior;
  }
});
