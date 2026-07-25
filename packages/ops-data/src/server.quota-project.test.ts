/**
 * Unit tests for Google Cloud quota-project inheritance used by Admin SDK
 * Identity Toolkit calls (local ADC revoke checks).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ensureGoogleCloudQuotaProject } from './server.ts';

const PREV = process.env.GOOGLE_CLOUD_QUOTA_PROJECT;

afterEach(() => {
  if (PREV === undefined) {
    delete process.env.GOOGLE_CLOUD_QUOTA_PROJECT;
  } else {
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT = PREV;
  }
});

test('ensureGoogleCloudQuotaProject inherits Firebase project when unset', () => {
  delete process.env.GOOGLE_CLOUD_QUOTA_PROJECT;
  const applied = ensureGoogleCloudQuotaProject('black-book-efaaf', {});
  assert.equal(applied, 'black-book-efaaf');
  assert.equal(process.env.GOOGLE_CLOUD_QUOTA_PROJECT, 'black-book-efaaf');
});

test('ensureGoogleCloudQuotaProject preserves an explicit env value', () => {
  delete process.env.GOOGLE_CLOUD_QUOTA_PROJECT;
  const applied = ensureGoogleCloudQuotaProject('black-book-efaaf', {
    GOOGLE_CLOUD_QUOTA_PROJECT: 'custom-quota',
  });
  assert.equal(applied, 'custom-quota');
  assert.equal(process.env.GOOGLE_CLOUD_QUOTA_PROJECT, 'custom-quota');
});
