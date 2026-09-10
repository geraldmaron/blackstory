/**
 * The published association files have to match the shipped binary exactly, and the Android one
 * has to stay absent until a real signing certificate exists. Both are asserted here because a
 * silent mismatch shows up only as "links don't open the app" on a device nobody is holding.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  androidCertFingerprints,
  appleAppId,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  UNIVERSAL_LINK_PATHS,
} from './app-links';

const REAL =
  'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';

test('appleAppId pairs the real team id with the production bundle', () => {
  assert.equal(appleAppId(), '4Q2XU7D33G.app.blackstory.mobile');
});

test('the association keeps web API routes out of the app', () => {
  const aasa = buildAppleAppSiteAssociation() as {
    applinks: { details: Array<{ appID: string; paths: string[] }> };
  };
  const [detail] = aasa.applinks.details;
  assert.equal(detail?.appID, '4Q2XU7D33G.app.blackstory.mobile');
  assert.deepEqual(detail?.paths, [...UNIVERSAL_LINK_PATHS]);
  for (const excluded of ['/search/api/*', '/corrections/api/*', '/submit/api/*']) {
    assert.ok(
      detail?.paths.includes(`NOT ${excluded}`),
      `${excluded} must be excluded from universal links`,
    );
  }
});

test('the placeholder fingerprint carried in the mobile fixture is never published', () => {
  assert.deepEqual(
    androidCertFingerprints('TODO_REPLACE_WITH_REAL_RELEASE_SIGNING_SHA256_FINGERPRINT'),
    [],
  );
  assert.equal(buildAssetLinks(androidCertFingerprints('TODO_REPLACE_WITH_REAL')), null);
});

test('assetlinks is absent until a well-formed fingerprint is configured', () => {
  assert.deepEqual(androidCertFingerprints(undefined), []);
  assert.deepEqual(androidCertFingerprints(''), []);
  assert.deepEqual(androidCertFingerprints('AB:CD'), []);
  assert.equal(buildAssetLinks([]), null);
});

test('a real fingerprint is normalized and published', () => {
  assert.deepEqual(androidCertFingerprints(REAL.toLowerCase()), [REAL]);
  assert.deepEqual(androidCertFingerprints(` ${REAL} , AB:CD `), [REAL]);
  assert.deepEqual(buildAssetLinks([REAL]), [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.blackstory.mobile',
        sha256_cert_fingerprints: [REAL],
      },
    },
  ]);
});
