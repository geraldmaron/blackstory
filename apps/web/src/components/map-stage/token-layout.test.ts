import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { MAP_TYPE } from '../../app/map/explore-style';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { placeGroupsFor, placeTier } from '../../lib/map-experience/place-map';
import {
  boxesIntersect,
  chooseCounted,
  layoutTokens,
  phoneNumeralBudget,
  placeCountList,
  markBox,
  numeralBox,
  type Box,
  type TokenInput,
} from './token-layout';

const DIGIT_EM = 0.62;

function token(key: string, x: number, y: number, count: number): TokenInput {
  const size = MAP_TYPE.count[placeTier(count)];
  return {
    key,
    x,
    y,
    count,
    width: String(count).length * size * DIGIT_EM,
    height: size,
  };
}

/** A small deterministic generator, so the dense input is the same on every run. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function assertClear(
  inputs: TokenInput[],
  obstacles: Box[],
  placements: ReturnType<typeof layoutTokens>,
) {
  const byKey = new Map(inputs.map((t) => [t.key, t]));
  const boxes = placements.map((p) => numeralBox(p, byKey.get(p.key)!));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(
        !boxesIntersect(boxes[i]!, boxes[j]!),
        `${placements[i]!.key} overlaps ${placements[j]!.key}`,
      );
    }
    for (const obstacle of obstacles) {
      assert.ok(!boxesIntersect(boxes[i]!, obstacle), `${placements[i]!.key} sits on a pin`);
    }
  }
}

test('a dense cluster lays out with no overlaps, every count kept, tethers only on moved tokens', () => {
  const rand = lcg(7);
  const inputs = Array.from({ length: 60 }, (_, i) =>
    token(`p${i}`, 300 + rand() * 200, 200 + rand() * 120, 1 + Math.floor(rand() ** 3 * 1200)),
  );
  const obstacles = Array.from({ length: 6 }, () =>
    markBox(300 + rand() * 200, 200 + rand() * 120, MAP_TYPE.ring + 4),
  );
  const placements = layoutTokens(inputs, obstacles);

  assert.equal(placements.length, inputs.length);
  assert.deepEqual(
    placements.map((p) => p.key),
    inputs.map((t) => t.key),
  );
  assertClear(inputs, obstacles, placements);
  assert.ok(
    placements.some((p) => p.displaced),
    'the input is dense enough to displace',
  );
  assert.ok(
    placements.some((p) => !p.displaced),
    'the input is sparse enough to keep some home',
  );
  for (const p of placements) {
    const t = inputs.find((i) => i.key === p.key)!;
    if (p.displaced) {
      assert.ok(p.leader, `${p.key} has a leader`);
      assert.deepEqual(p.leader.to, { x: t.x, y: t.y }, 'the leader ends on the anchor');
      assert.ok(!p.nameShown);
    } else {
      assert.equal(p.leader, undefined);
      assert.deepEqual([p.x, p.y], [t.x, t.y]);
    }
  }
  assert.deepEqual(
    layoutTokens([...inputs].reverse(), obstacles).sort(byKey),
    [...placements].sort(byKey),
  );
});

const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : 1);

test('the largest count keeps its anchor and a lone token never moves', () => {
  const a = token('big', 100, 100, 500);
  const b = token('small', 101, 100, 3);
  const [pa, pb] = layoutTokens([a, b], []);
  assert.equal(pa!.displaced, false);
  assert.equal(pb!.displaced, true);
  assert.equal(layoutTokens([b], [])[0]!.displaced, false);
});

test('a name yields before its numeral moves', () => {
  const named = { ...token('a', 100, 100, 5), name: { dx: 12, width: 60, height: 12 } };
  const blocker = markBox(150, 100, 14);
  const [p] = layoutTokens([named], [blocker]);
  assert.equal(p!.displaced, false);
  assert.equal(p!.nameShown, false);
  assert.equal(layoutTokens([named], [])[0]!.nameShown, true);
});

test('the seed catalog laid out at a national frame has no overlapping numerals', () => {
  const entities = listPublicEntities();
  const groups = placeGroupsFor(buildExploreMapSource(entities).featureCollection, undefined);
  const zoom = 4;
  const world = 512 * 2 ** zoom;
  const project = ([lng, lat]: readonly [number, number]) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return {
      x: ((lng + 180) / 360) * world,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world,
    };
  };
  const centre = project([-96, 38]);
  const inputs = groups.tokens
    .filter((t) => t.minZoom <= zoom && zoom < t.maxZoom)
    .map((t) => {
      const p = project(t.anchor);
      return token(t.placeKey, p.x - centre.x + 720, p.y - centre.y + 450, t.memberIds.length);
    })
    .filter((t) => t.x >= 0 && t.x <= 1440 && t.y >= 0 && t.y <= 900);
  assert.ok(inputs.length > 0, 'the seed has tokens at zoom 4');
  assertClear(inputs, [], layoutTokens(inputs, []));
});

test('a phone prints at most the budget of numerals, none overlap, the selected place always prints', () => {
  const rand = lcg(11);
  const all = Array.from({ length: 48 }, (_, i) =>
    token(`state-${i}`, 20 + rand() * 350, 40 + rand() * 420, 1 + Math.floor(rand() ** 2 * 900)),
  );
  const budget = phoneNumeralBudget(390, 500);
  assert.equal(budget, 6);
  // The smallest state is the selected one.
  const smallest = [...all].sort((a, b) => a.count - b.count || (a.key < b.key ? -1 : 1))[0]!;
  const chosen = chooseCounted(all, budget, new Set([smallest.key]));
  assert.equal(chosen.size, budget + 1);
  assert.ok(chosen.has(smallest.key));
  const top = [...all]
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))
    .slice(0, budget);
  for (const t of top) assert.ok(chosen.has(t.key));
  const shown = all.filter((t) => chosen.has(t.key));
  assertClear(shown, [], layoutTokens(shown, []));
  assert.deepEqual(chooseCounted(all, budget, new Set([smallest.key])), chosen);
});

test('the text equivalent lists every place in view, largest first, with its unit', () => {
  const lines = placeCountList([
    { key: 'a', name: 'Alabama', count: 1 },
    { key: 'g', name: 'Georgia', count: 1239 },
    { key: 'm', name: 'Maine', count: 12 },
  ]);
  assert.deepEqual(lines, ['Georgia, 1,239 records', 'Maine, 12 records', 'Alabama, 1 record']);
});
