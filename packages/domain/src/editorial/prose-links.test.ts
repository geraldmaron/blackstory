/**
 * Tests for entity prose-link parse, strip, serialize, and catalog linkification.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENTITY_PROSE_LINK_RE,
  linkifyProseAgainstCatalog,
  parseProseEntityLinks,
  serializeProseEntityLink,
  stripProseEntityLinks,
} from './prose-links.js';

test('parseProseEntityLinks returns refs in document order', () => {
  const text = 'See [[entity-a|Alpha]] and [[entity-b]] near [[entity-c|Gamma]].';
  assert.deepEqual(parseProseEntityLinks(text), [
    { entityId: 'entity-a', label: 'Alpha' },
    { entityId: 'entity-b' },
    { entityId: 'entity-c', label: 'Gamma' },
  ]);
});

test('stripProseEntityLinks keeps labels as visible text', () => {
  const text = 'Linked [[entity-a|Alpha School]] and [[entity-b]].';
  assert.equal(stripProseEntityLinks(text), 'Linked Alpha School and entity-b.');
});

test('serializeProseEntityLink round-trips markup', () => {
  assert.equal(
    serializeProseEntityLink({ entityId: 'entity-a', label: 'Alpha' }),
    '[[entity-a|Alpha]]',
  );
  assert.equal(serializeProseEntityLink({ entityId: 'entity-a' }), '[[entity-a]]');
});

test('ENTITY_PROSE_LINK_RE matches optional labels', () => {
  const matches = [...'[[id|Label]] [[id2]]'.matchAll(ENTITY_PROSE_LINK_RE)];
  assert.equal(matches.length, 2);
  assert.deepEqual([matches[0]![1], matches[0]![2]], ['id', 'Label']);
  assert.deepEqual([matches[1]![1], matches[1]![2]], ['id2', undefined]);
});

test('linkifyProseAgainstCatalog prefers longest names and skips protected markup', () => {
  const catalog = [
    { id: 'subject-1', displayName: 'Harlem', aliases: ['Harlem Renaissance'] },
    { id: 'subject-2', displayName: 'Harlem School' },
  ];
  const input =
    'Harlem Renaissance flourished near Harlem School. Existing [[subject-1|Harlem]] stays.';
  const result = linkifyProseAgainstCatalog(input, catalog, { skipEntityIds: ['subject-9'] });

  assert.ok(result.text.includes('[[subject-1|Harlem Renaissance]]'));
  assert.ok(result.text.includes('[[subject-2|Harlem School]]'));
  assert.ok(result.text.includes('[[subject-1|Harlem]]'));
  assert.equal(result.links.length, 2);
});

// Reproduces a live incident: "John" (a lynching victim recorded under only a
// first name in the historical source, id lynching_john_marshall_missouri)
// was wrongly auto-linked from inside OTHER, unrelated victims' summaries —
// "John Tucker", "John Taylor" — just because their names also start with
// "John", and separately "Jim Crow" was auto-linked to a same-named "Jim".
test('linkifyProseAgainstCatalog does not absorb a short name into someone else\'s longer name', () => {
  const catalog = [{ id: 'lynching_john_marshall_missouri', displayName: 'John' }];
  const result = linkifyProseAgainstCatalog('John Tucker was lynched in Indianapolis.', catalog);
  assert.equal(result.text, 'John Tucker was lynched in Indianapolis.');
  assert.equal(result.links.length, 0);
});

test('linkifyProseAgainstCatalog does not link a short name into an unrelated capitalized phrase', () => {
  const catalog = [{ id: 'lynching_jim_marshall_missouri', displayName: 'Jim' }];
  const result = linkifyProseAgainstCatalog('Segregation continued into the Jim Crow era.', catalog);
  assert.equal(result.text, 'Segregation continued into the Jim Crow era.');
  assert.equal(result.links.length, 0);
});

test('linkifyProseAgainstCatalog still links a short name when not followed by a capitalized word', () => {
  const catalog = [{ id: 'lynching_john_marshall_missouri', displayName: 'John' }];
  const result = linkifyProseAgainstCatalog('John was tied to a stake by the mob.', catalog);
  assert.equal(result.text, '[[lynching_john_marshall_missouri|John]] was tied to a stake by the mob.');
  assert.equal(result.links.length, 1);
});

test('linkifyProseAgainstCatalog skips subject ids and uses case-sensitive boundaries', () => {
  const catalog = [{ id: 'entity-a', displayName: 'Alpha' }];
  const skipped = linkifyProseAgainstCatalog('Alpha alpha', catalog, {
    skipEntityIds: ['entity-a'],
  });
  assert.equal(skipped.text, 'Alpha alpha');
  assert.equal(skipped.links.length, 0);

  const linked = linkifyProseAgainstCatalog('Visit Alpha today.', catalog);
  assert.equal(linked.text, 'Visit [[entity-a|Alpha]] today.');
  assert.deepEqual(linked.links, [{ entityId: 'entity-a', label: 'Alpha' }]);
});
