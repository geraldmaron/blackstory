import assert from 'node:assert/strict';
import { test } from 'node:test';
import robots, { CRAWL_TRAP_DISALLOWS } from './robots';

test('robots.txt disallows the query-string crawl traps for every agent, and nothing else', () => {
  const rules = robots().rules;
  const all = (Array.isArray(rules) ? rules : [rules]).find((rule) => rule.userAgent === '*');
  assert.ok(all !== undefined);
  assert.equal(all.allow, '/');
  assert.deepEqual(all.disallow, [...CRAWL_TRAP_DISALLOWS]);
  // The bare surfaces and single-facet narrowings must stay crawlable.
  for (const pattern of CRAWL_TRAP_DISALLOWS) {
    assert.notEqual(pattern, '/records');
    assert.notEqual(pattern, '/explore');
    assert.notEqual(pattern, '/records?');
  }
});
