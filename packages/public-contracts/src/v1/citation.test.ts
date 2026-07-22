import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { citationV1Schema } from './citation.js';

test('round-trips a valid public citation', () => {
  const input = { source: 'D.C. Board of Education annual report, 1916', label: '1916 annual report', href: 'https://example.gov/dc-board-1916' };
  assert.deepEqual(citationV1Schema.parse(input), input);
});

test('rejects an invalid href (adversarial: invalid URL)', () => {
  assert.throws(() => citationV1Schema.parse({ source: 'x', label: 'y', href: 'javascript:alert(1)' }));
  assert.throws(() => citationV1Schema.parse({ source: 'x', label: 'y', href: 'not a url' }));
});

test('drops internal-only fields on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('citation.v1.sensitive-leak.json');
  const parsed = citationV1Schema.parse(fixture);

  // Public-safe fields survive.
  assert.equal(parsed.source, fixture.source);
  assert.equal(parsed.withheldReason, fixture.withheldReason);

  // Internal-only fields must NOT be present on the parsed result, even though the input had them.
  assert.ok(!('protectedReason' in parsed), 'protectedReason must not survive parsing');
  assert.ok(!('protectedFromPublicLink' in parsed), 'protectedFromPublicLink must not survive parsing');
  assert.ok(!('internalDocumentId' in parsed), 'internalDocumentId must not survive parsing');
  assert.deepEqual(Object.keys(parsed).sort(), ['label', 'source', 'withheldReason']);
});
