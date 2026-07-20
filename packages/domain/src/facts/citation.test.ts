import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertFactCitationStructurallyComplete,
  isFactCitationStructurallyComplete,
  isWebFactCitation,
  type FactCitation,
} from './citation.js';

function webCitation(overrides: Partial<FactCitation> = {}): FactCitation {
  return {
    csl: {
      id: 'csl-1',
      type: 'webpage',
      title: 'Montgomery bus boycott record',
      URL: 'https://example.gov/mia',
    },
    sourceClass: 'primary',
    role: 'supports',
    excerpt: 'Rosa Parks was arrested on December 1, 1955.',
    archivedUrl: 'https://web.archive.org/web/20260101000000/https://example.gov/mia',
    archivedAt: '2026-01-01T00:00:00.000Z',
    accessedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

test('a complete web citation passes validation', () => {
  const citation = webCitation();
  assert.equal(isWebFactCitation(citation), true);
  assert.doesNotThrow(() => assertFactCitationStructurallyComplete(citation));
  assert.equal(isFactCitationStructurallyComplete(citation), true);
});

test('a web citation missing archivedUrl fails closed', () => {
  const citation = webCitation({ archivedUrl: undefined });
  assert.equal(isFactCitationStructurallyComplete(citation), false);
});

test('a web citation missing accessedAt fails closed', () => {
  const citation = webCitation({ accessedAt: undefined });
  assert.equal(isFactCitationStructurallyComplete(citation), false);
});

test('a web citation with a non-ISO archivedAt fails closed', () => {
  const citation = webCitation({ archivedAt: 'not-a-date' });
  assert.equal(isFactCitationStructurallyComplete(citation), false);
});

test('an offline (non-web) citation only needs a valid accessedAt, no archivedUrl', () => {
  const citation = webCitation({
    csl: { id: 'csl-2', type: 'book' },
    archivedUrl: undefined,
    archivedAt: undefined,
    url: undefined,
  });
  assert.equal(isWebFactCitation(citation), false);
  assert.equal(isFactCitationStructurallyComplete(citation), true);
});

test('a citation with an empty excerpt fails closed', () => {
  const citation = webCitation({ excerpt: '   ' });
  assert.equal(isFactCitationStructurallyComplete(citation), false);
});

test('a citation with an unknown sourceClass or role throws', () => {
  assert.throws(() =>
    assertFactCitationStructurallyComplete(webCitation({ sourceClass: 'quaternary' as never })),
  );
  assert.throws(() =>
    assertFactCitationStructurallyComplete(webCitation({ role: 'endorses' as never })),
  );
});
