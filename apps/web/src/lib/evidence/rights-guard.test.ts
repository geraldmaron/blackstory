/**
 * Unit tests for rights-limited excerpt/citation resolution (source links do not leak private
 * evidence or protected information).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCitationForDisplay, resolveExcerptForDisplay } from './rights-guard';

test('a short excerpt with unresolved rights is still visible (short excerpts do not require resolved rights)', () => {
  const result = resolveExcerptForDisplay({
    text: 'A brief quoted phrase judged relevant to the claim.',
    excerptKind: 'short',
    rightsStatus: 'unknown',
  });
  assert.equal(result.visible, true);
});

test('a substantial excerpt with restricted rights is withheld', () => {
  const result = resolveExcerptForDisplay({
    text: 'A longer passage that would need explicit publication rights.',
    excerptKind: 'substantial',
    rightsStatus: 'restricted',
  });
  assert.equal(result.visible, false);
  if (!result.visible) {
    assert.match(result.reason, /restricted/);
  }
});

test('a substantial excerpt with resolved public-domain rights and the granted permission is visible', () => {
  const result = resolveExcerptForDisplay({
    text: 'A longer passage with resolved public-domain rights.',
    excerptKind: 'substantial',
    rightsStatus: 'public_domain',
    publicationPermissions: ['substantial_excerpt'],
  });
  assert.equal(result.visible, true);
  if (result.visible) {
    assert.equal(result.text, 'A longer passage with resolved public-domain rights.');
  }
});

test('a substantial excerpt with resolved rights but no granted permission is withheld', () => {
  const result = resolveExcerptForDisplay({
    text: 'A longer passage lacking the specific granted permission.',
    excerptKind: 'substantial',
    rightsStatus: 'public_domain',
    publicationPermissions: [],
  });
  assert.equal(result.visible, false);
});

test('an empty excerpt is withheld with a not-available reason rather than rendering blank', () => {
  const result = resolveExcerptForDisplay({
    text: '   ',
    excerptKind: 'none',
    rightsStatus: 'unknown',
  });
  assert.equal(result.visible, false);
  if (!result.visible) {
    assert.match(result.reason, /No excerpt is available/);
  }
});

test('a citation flagged as protected withholds its outbound link and source label stays intact', () => {
  const view = resolveCitationForDisplay({
    source: 'Internal case file (protected)',
    label: 'Restricted source',
    href: 'https://internal.example.org/protected-record',
    protectedFromPublicLink: true,
  });
  assert.equal(view.href, undefined);
  assert.equal(view.source, 'Internal case file (protected)');
  assert.ok(view.withheldReason);
  assert.doesNotMatch(view.withheldReason ?? '', /internal\.example\.org/);
});

test('a citation flagged as protected uses a caller-supplied reason when provided', () => {
  const view = resolveCitationForDisplay({
    source: 'Living-person-sensitive capture',
    label: 'Protected source',
    href: 'https://internal.example.org/sensitive',
    protectedFromPublicLink: true,
    protectedReason: 'Withheld under living-person protections.',
  });
  assert.equal(view.withheldReason, 'Withheld under living-person protections.');
});

test('an unprotected citation with a public href renders the link normally', () => {
  const view = resolveCitationForDisplay({
    source: 'National Archives and Records Administration',
    label: 'Primary archival',
    href: 'https://catalog.archives.gov/',
  });
  assert.equal(view.href, 'https://catalog.archives.gov/');
  assert.equal(view.withheldReason, undefined);
});
