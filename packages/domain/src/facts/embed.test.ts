import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixtureCitation, buildFixtureFact } from './fixtures.js';
import { buildCompactFactView, buildCompactFactViewsForEntity } from './embed.js';

test('buildCompactFactView carries the canonical URL and citation set every embed shares', () => {
  const fact = buildFixtureFact();
  const view = buildCompactFactView(fact);
  assert.equal(view.canonicalUrl, `/facts/${fact.id}/${fact.slug}`);
  assert.equal(view.citationCount, 1);
  assert.ok(view.primaryCitation);
  assert.equal(view.primaryCitation?.href, fact.citations[0]!.archivedUrl);
  assert.deepEqual(view.subjects, [{ entityId: 'ent_rosa_parks', kind: 'person' }]);
});

test('buildCompactFactView prefers a supports-role citation as primary', () => {
  const contradicts = buildFixtureCitation({ csl: { id: 'c1', type: 'webpage' }, role: 'contradicts' });
  const supports = buildFixtureCitation({ csl: { id: 'c2', type: 'webpage' }, role: 'supports' });
  const fact = buildFixtureFact({ citations: [contradicts, supports] });
  const view = buildCompactFactView(fact);
  assert.equal(view.primaryCitation?.role, 'supports');
});

test('buildCompactFactView falls back to the first citation when none supports', () => {
  const contradicts = buildFixtureCitation({ csl: { id: 'c1', type: 'webpage' }, role: 'contradicts' });
  const fact = buildFixtureFact({ citations: [contradicts] });
  const view = buildCompactFactView(fact);
  assert.equal(view.primaryCitation?.role, 'contradicts');
});

test('buildCompactFactView omits primaryCitation when there are no citations', () => {
  const fact = buildFixtureFact({ status: 'draft', citations: [] });
  const view = buildCompactFactView(fact);
  assert.equal(view.primaryCitation, undefined);
  assert.equal(view.citationCount, 0);
});

test('buildCompactFactViewsForEntity finds every fact naming the entity as a subject', () => {
  const factA = buildFixtureFact();
  const factB = buildFixtureFact({ subjects: [{ entityId: 'ent_other', kind: 'place' }] });
  const views = buildCompactFactViewsForEntity('ent_rosa_parks', [factA, factB]);
  assert.equal(views.length, 1);
  assert.equal(views[0]!.id, factA.id);
});
