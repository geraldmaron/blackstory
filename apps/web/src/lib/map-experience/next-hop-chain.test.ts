import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendNextHop, nextHopInto, type NextHop } from './next-hop-chain';

test('a Next chain A→B→C unwinds one history step per Back', () => {
  let chain: NextHop[] = [];
  chain = appendNextHop(chain, { from: 'a', to: 'b' });
  chain = appendNextHop(chain, { from: 'b', to: 'c' });
  assert.equal(nextHopInto(chain, 'c'), 'b');
  chain = chain.slice(0, -1); // Back to b
  assert.equal(nextHopInto(chain, 'b'), 'a');
  chain = chain.slice(0, -1); // Back to a
  assert.equal(nextHopInto(chain, 'a'), null);
});

test('a Next from outside the chain starts a new run', () => {
  const chain = appendNextHop([{ from: 'a', to: 'b' }], { from: 'x', to: 'y' });
  assert.deepEqual(chain, [{ from: 'x', to: 'y' }]);
  assert.equal(nextHopInto(chain, 'b'), null);
});
