/**
 * Unit tests for catalog kind-hygiene linter.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { lintKindHygiene, mergeKindHygieneLintReports } from './kind-hygiene-linter.ts';

test('lintKindHygiene errors on person-shaped discovery id modeled as event', () => {
  const report = lintKindHygiene({
    entityId: 'disc_crispus_attucks_q288241',
    kind: 'event',
    displayName: 'Crispus Attucks',
    entityClass: 'event',
    livingStatus: 'not_applicable',
  });
  assert.equal(report.hasErrors, true);
  assert.equal(report.findings[0]?.code, 'person_as_event');
});

test('lintKindHygiene passes event-shaped discovery records', () => {
  const report = lintKindHygiene({
    entityId: 'disc_tulsa_race_massacre_q1824714',
    kind: 'event',
    displayName: 'Tulsa race massacre',
    entityClass: 'event',
    livingStatus: 'not_applicable',
  });
  assert.equal(report.hasErrors, false);
});

test('lintKindHygiene errors on duplicate topicTags', () => {
  const report = lintKindHygiene({
    entityId: 'ent_example',
    kind: 'person',
    topicTags: ['abolition', 'bobsled', 'bobsled'],
  });
  assert.equal(report.hasErrors, true);
  assert.equal(
    report.findings.some((f) => f.code === 'duplicate_topic_tags'),
    true,
  );
});

test('mergeKindHygieneLintReports combines findings', () => {
  const merged = mergeKindHygieneLintReports([
    lintKindHygiene({ entityId: 'a', kind: 'event', entityClass: 'person' }),
    lintKindHygiene({ entityId: 'b', kind: 'person', topicTags: ['x', 'x'] }),
  ]);
  assert.equal(merged.findings.length, 2);
  assert.equal(merged.hasErrors, true);
});
