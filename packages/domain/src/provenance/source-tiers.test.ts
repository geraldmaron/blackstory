import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupSourceTier, isAnchorTierUrl, SOURCE_TIER_RULES } from './source-tiers.js';

test('classifies official statistical agencies as T1', () => {
  assert.equal(lookupSourceTier('https://www.census.gov/data/tables/x.html').tier, 'T1');
  assert.equal(lookupSourceTier('https://bjs.ojp.gov/library/publications/y').tier, 'T1');
  assert.equal(lookupSourceTier('https://www.federalreserve.gov/scf/index.htm').tier, 'T1');
});

test('subdomains inherit their registrable-domain rule', () => {
  assert.equal(lookupSourceTier('https://apps.bea.gov/national').tier, 'T1');
  assert.equal(lookupSourceTier('https://www.vera.org/publications').tier, 'T3');
});

test('longest matching rule wins over generic .gov fallback', () => {
  // ussc.gov is explicitly T1; a bare .gov host falls back to T2.
  assert.equal(lookupSourceTier('https://www.ussc.gov/research').matchedDomain, 'ussc.gov');
  assert.equal(lookupSourceTier('https://www.ussc.gov/research').tier, 'T1');
  const someGov = lookupSourceTier('https://www.michigan.gov/agency');
  assert.equal(someGov.tier, 'T2');
  assert.equal(someGov.matchedDomain, 'gov');
});

test('archives and replication repositories are T2 anchors', () => {
  assert.equal(lookupSourceTier('https://dataverse.harvard.edu/dataset').tier, 'T2');
  assert.equal(lookupSourceTier('https://www.openicpsr.org/openicpsr/project/127803').tier, 'T2');
  assert.ok(isAnchorTierUrl('https://www.nber.org/papers/w12345'));
});

test('state historical societies classify by their registry entries', () => {
  assert.equal(lookupSourceTier('https://www.okhistory.org/research/forms/freport.pdf').tier, 'T2');
  assert.equal(
    lookupSourceTier('https://tulsahistory.org/exhibit/1921-tulsa-race-massacre/').tier,
    'T3',
  );
});

test('unclassified hosts default to T4 and are not anchors', () => {
  const result = lookupSourceTier('https://some-random-blog.example.com/post');
  assert.equal(result.tier, 'T4');
  assert.equal(result.matchedDomain, null);
  assert.equal(isAnchorTierUrl('https://some-random-blog.example.com/post'), false);
});

test('anchor tiers are exactly T1 and T2', () => {
  assert.equal(isAnchorTierUrl('https://www.census.gov/x'), true); // T1
  assert.equal(isAnchorTierUrl('https://www.loc.gov/x'), true); // T2
  assert.equal(isAnchorTierUrl('https://www.propublica.org/x'), false); // T3
});

test('malformed URL surfaces as non-anchor rather than throwing', () => {
  assert.equal(isAnchorTierUrl('not a url'), false);
});

test('registry rules use only the four defined tiers', () => {
  for (const rule of SOURCE_TIER_RULES) {
    assert.match(rule.tier, /^T[1-4]$/);
    assert.ok(rule.rationale.length > 0);
  }
});
