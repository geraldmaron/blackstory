import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHumanProbeQuery, humanQids } from './check-wikidata-person-kinds.ts';

test('the probe lists valid QIDs only and asks for instance of human', () => {
  const query = buildHumanProbeQuery(['Q42', 'bad', 'Q7442135']);
  assert.match(query, /VALUES \?item \{ wd:Q42 wd:Q7442135 \}/u);
  assert.match(query, /wdt:P31 wd:Q5/u);
});

test('human QIDs are read from SPARQL bindings', () => {
  const ids = humanQids({
    results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q42' } }] },
  });
  assert.deepEqual([...ids], ['Q42']);
});
