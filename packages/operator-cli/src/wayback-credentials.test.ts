import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waybackCredentialsFromEnv } from './wayback-credentials.js';

test('waybackCredentialsFromEnv returns undefined when either key is missing or blank', () => {
  assert.equal(waybackCredentialsFromEnv({}), undefined);
  assert.equal(
    waybackCredentialsFromEnv({
      INTERNET_ARCHIVE_ACCESS_KEY: 'ak',
      INTERNET_ARCHIVE_SECRET_KEY: '',
    }),
    undefined,
  );
  assert.equal(
    waybackCredentialsFromEnv({
      INTERNET_ARCHIVE_ACCESS_KEY: '  ',
      INTERNET_ARCHIVE_SECRET_KEY: 'sk',
    }),
    undefined,
  );
});

test('waybackCredentialsFromEnv returns trimmed credentials when both keys are present', () => {
  const creds = waybackCredentialsFromEnv({
    INTERNET_ARCHIVE_ACCESS_KEY: '  access  ',
    INTERNET_ARCHIVE_SECRET_KEY: ' secret ',
  });
  assert.deepEqual(creds, { accessKey: 'access', secretKey: 'secret' });
});
