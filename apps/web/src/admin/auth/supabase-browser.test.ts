import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminAuthRequestUrl } from './supabase-browser';

const SUPABASE_URL = 'https://example.supabase.co';

test('admin Auth transport keeps token, refresh, user, and logout on the app origin', () => {
  assert.equal(
    adminAuthRequestUrl(
      'https://example.supabase.co/auth/v1/token?grant_type=password',
      SUPABASE_URL,
    ),
    '/api/admin-auth/token?grant_type=password',
  );
  assert.equal(
    adminAuthRequestUrl(
      new Request('https://example.supabase.co/auth/v1/token?grant_type=refresh_token'),
      SUPABASE_URL,
    ),
    '/api/admin-auth/token?grant_type=refresh_token',
  );
  assert.equal(
    adminAuthRequestUrl('https://example.supabase.co/auth/v1/user', SUPABASE_URL),
    '/api/admin-auth/user',
  );
  assert.equal(
    adminAuthRequestUrl('https://example.supabase.co/auth/v1/logout?scope=global', SUPABASE_URL),
    '/api/admin-auth/logout?scope=global',
  );
});

test('admin Auth transport does not relay other projects or Supabase APIs', () => {
  for (const url of [
    'https://other.supabase.co/auth/v1/token',
    'https://example.supabase.co/rest/v1/users',
    'https://example.supabase.co/auth/v1/signup',
    'https://example.supabase.co/auth/v1/token/extra',
  ]) {
    assert.equal(adminAuthRequestUrl(url, SUPABASE_URL), null, url);
  }
});
