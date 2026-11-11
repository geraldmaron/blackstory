import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminFramingHeaders } from './admin-framing';

const CSP =
  "default-src 'self'; frame-ancestors 'none'; frame-src https://www.youtube-nocookie.com https://archive.org; object-src 'none'";

test('public routes keep the site-wide framing policy', () => {
  assert.equal(adminFramingHeaders('/stories/the-count', CSP), null);
  assert.equal(adminFramingHeaders('/administrator', CSP), null);
});

test('admin pages may frame same-origin documents and stay unframeable', () => {
  const out = adminFramingHeaders('/admin/stories/the-count', CSP)!;
  assert.match(
    out.csp,
    /frame-src 'self' https:\/\/www\.youtube-nocookie\.com https:\/\/archive\.org;/,
  );
  assert.match(out.csp, /frame-ancestors 'none'/);
  assert.equal(out.frameOptions, undefined);
});

test('only the embedded story preview may be framed, and only by its own origin', () => {
  const out = adminFramingHeaders('/admin/stories/the-count/preview/embed', CSP)!;
  assert.match(out.csp, /frame-ancestors 'self'/);
  assert.equal(out.frameOptions, 'SAMEORIGIN');
  const plain = adminFramingHeaders('/admin/stories/the-count/preview', CSP)!;
  assert.match(plain.csp, /frame-ancestors 'none'/);
  assert.equal(
    adminFramingHeaders('/admin/stories/a/b/preview/embed', CSP)!.frameOptions,
    undefined,
  );
});
