/**
 * Tests for public/admin sibling origin resolution used for operator handoff links.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveAdminOrigin,
  resolvePublicSiteOrigin,
  siblingHref,
} from './sibling-origins.ts';

test('explicit public and admin origins win over defaults', () => {
  assert.equal(
    resolvePublicSiteOrigin({
      NEXT_PUBLIC_SITE_URL: 'https://blackstory.example/',
      NEXT_PUBLIC_APP_ENV: 'production',
    }),
    'https://blackstory.example',
  );
  assert.equal(
    resolveAdminOrigin({
      NEXT_PUBLIC_ADMIN_ORIGIN: 'https://admin.blackstory.example/',
      NEXT_PUBLIC_APP_ENV: 'production',
    }),
    'https://admin.blackstory.example',
  );
});

test('development falls back to local ports when unset', () => {
  assert.equal(
    resolvePublicSiteOrigin({ NEXT_PUBLIC_APP_ENV: 'development' }),
    'http://localhost:3048',
  );
  assert.equal(
    resolveAdminOrigin({ NODE_ENV: 'development' }),
    'http://localhost:3001',
  );
});

test('production stays silent without explicit origins', () => {
  assert.equal(
    resolvePublicSiteOrigin({ NEXT_PUBLIC_APP_ENV: 'production', NODE_ENV: 'production' }),
    null,
  );
  assert.equal(
    resolveAdminOrigin({ NEXT_PUBLIC_APP_ENV: 'production', NODE_ENV: 'production' }),
    null,
  );
});

test('siblingHref joins origin and path cleanly', () => {
  assert.equal(siblingHref('http://localhost:3048/', '/stories'), 'http://localhost:3048/stories');
  assert.equal(siblingHref('http://localhost:3001', 'stories/review'), 'http://localhost:3001/stories/review');
});
