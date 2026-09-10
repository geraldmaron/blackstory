/**
 * The semantic destination catalog's invariants, as tests rather than as habits.
 *
 * Most of these exist because the property they assert has already been violated in shipped
 * code: primary navigation pointed at a redirect, two registries disagreed about the same
 * route, and a myth-correction address was routed to Methodology, which answers a different
 * question. A comment does not stop any of that from happening again.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DESTINATION_FAMILIES,
  DESTINATION_ICON_IDS,
  LEGACY_ALIASES,
  allSemanticDestinations,
  canonicalPathForLegacy,
  isLegacyPath,
  normalizeDestinationPath,
  primaryAxes,
  semanticDestinationByPath,
  semanticDestinationsInFamily,
} from './destinations.js';

const destinations = allSemanticDestinations();
const paths = new Set(destinations.map((destination) => destination.path));

test('every destination id and path is unique', () => {
  const ids = destinations.map((destination) => destination.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate destination id');
  assert.equal(paths.size, destinations.length, 'duplicate destination path');
});

test('every parent resolves to a destination in the table, and only the door has none', () => {
  const withoutParent = destinations.filter((destination) => destination.parent === null);
  assert.deepEqual(
    withoutParent.map((destination) => destination.path),
    ['/'],
    'exactly one root, and it is the door',
  );
  for (const destination of destinations) {
    if (destination.parent === null) continue;
    assert.ok(
      paths.has(destination.parent),
      `${destination.path} parents to ${destination.parent}, which is not a destination`,
    );
  }
});

test('the parent chain terminates at the door with no cycles', () => {
  for (const destination of destinations) {
    const seen = new Set<string>([destination.path]);
    let current = destination.parent;
    while (current !== null) {
      assert.ok(!seen.has(current), `cycle in the parent chain at ${current}`);
      seen.add(current);
      current = semanticDestinationByPath(current)?.parent ?? null;
    }
    assert.ok(seen.has('/'), `${destination.path} does not reach the door`);
  }
});

test('primary navigation is the four product axes, in order', () => {
  assert.deepEqual(
    primaryAxes().map((destination) => destination.label),
    ['Explore', 'Stories', 'Records', 'Rooms'],
  );
  assert.deepEqual(
    primaryAxes().map((destination) => destination.path),
    ['/explore', '/stories', '/records', '/rooms'],
  );
});

test('the door is not a primary nav item — it is reached through the brand lockup', () => {
  assert.ok(!primaryAxes().some((destination) => destination.path === '/'));
});

test('Stories and Records are top-level axes, not children of Rooms', () => {
  // Modeling them under Rooms was the old Library hierarchy surviving a rename: it told a
  // reader the archive index was a supporting page rather than a way into the product.
  for (const path of ['/stories', '/records']) {
    const destination = semanticDestinationByPath(path);
    assert.ok(destination, `${path} is missing from the catalog`);
    assert.equal(destination.parent, '/', `${path} must parent to the door`);
    assert.equal(destination.family, 'axis');
  }
});

test('no canonical path is also a legacy alias', () => {
  for (const destination of destinations) {
    assert.equal(
      isLegacyPath(destination.path),
      false,
      `${destination.path} is canonical and must not be aliased`,
    );
  }
});

test('every legacy alias resolves to a canonical destination in one hop', () => {
  for (const alias of LEGACY_ALIASES) {
    assert.ok(
      paths.has(alias.to),
      `${alias.from} redirects to ${alias.to}, which is not a destination`,
    );
    assert.equal(
      canonicalPathForLegacy(alias.to),
      null,
      `${alias.from} -> ${alias.to} is a redirect chain`,
    );
    assert.ok(alias.because.length > 0, `${alias.from} has no recorded reason`);
  }
});

test('subtree aliases cover their children', () => {
  assert.equal(canonicalPathForLegacy('/chapters/tulsa-1921'), '/stories');
  assert.equal(canonicalPathForLegacy('/themes/redlining'), '/stories');
  assert.equal(canonicalPathForLegacy('/library'), '/rooms');
  // `/library` is not a subtree alias, so a child of it is not silently swallowed.
  assert.equal(canonicalPathForLegacy('/library/anything'), null);
});

test('myth corrections resolve to Stories, never to Methodology', () => {
  // Methodology answers "how does BlackStory know?". A myth correction answers "is this
  // historical claim actually true?" — a different reader intent and a narrative format.
  assert.equal(canonicalPathForLegacy('/myths'), '/stories');
  assert.equal(canonicalPathForLegacy('/myths/40-acres'), '/stories');
});

test('product policy is never routed into historical Law', () => {
  const privacy = semanticDestinationByPath('/privacy');
  assert.ok(privacy);
  assert.equal(privacy.family, 'policy');
  const law = semanticDestinationByPath('/law');
  assert.ok(law);
  assert.equal(law.family, 'read');
  // `/legal` meant historical legal reference. If a policy address were ever added to the alias
  // table pointing at Law, this fails.
  for (const alias of LEGACY_ALIASES) {
    if (alias.to !== '/law') continue;
    assert.ok(
      !['/privacy', '/terms'].includes(alias.from),
      `${alias.from} is product policy and must not resolve to historical Law`,
    );
  }
});

test('History and Search are aliases of Records, not destinations of their own', () => {
  assert.equal(canonicalPathForLegacy('/history'), '/records');
  assert.equal(canonicalPathForLegacy('/search'), '/records');
  assert.equal(semanticDestinationByPath('/history'), undefined);
  assert.equal(semanticDestinationByPath('/search'), undefined);
});

test('Topics, Themes, Chapters and Facts are not standalone destinations', () => {
  for (const path of ['/topics', '/themes', '/chapters', '/facts', '/articles', '/myths']) {
    assert.equal(semanticDestinationByPath(path), undefined, `${path} must not be a destination`);
    assert.ok(isLegacyPath(path), `${path} must resolve as a legacy alias`);
  }
});

test('every family and icon id used is in the declared vocabulary', () => {
  for (const destination of destinations) {
    assert.ok(
      (DESTINATION_FAMILIES as readonly string[]).includes(destination.family),
      `${destination.id} has family ${destination.family}`,
    );
    assert.ok(
      (DESTINATION_ICON_IDS as readonly string[]).includes(destination.icon),
      `${destination.id} has icon ${destination.icon}`,
    );
  }
});

test('an axis destination carries an axis, and a non-axis destination does not', () => {
  for (const destination of destinations) {
    if (destination.family === 'axis') {
      assert.ok(destination.axis, `${destination.id} is an axis with no axis id`);
    } else {
      assert.equal(destination.axis, undefined, `${destination.id} is not an axis`);
    }
  }
});

test('the Rooms families each hold the destinations Rooms groups them under', () => {
  assert.deepEqual(
    semanticDestinationsInFamily('read').map((destination) => destination.label),
    ['Law', 'Data', 'Banned books', 'Memorial'],
  );
  assert.deepEqual(
    semanticDestinationsInFamily('trust').map((destination) => destination.label),
    ['About', 'Questions', 'Methodology', 'Errata'],
  );
  assert.deepEqual(
    semanticDestinationsInFamily('participate').map((destination) => destination.label),
    ['Submit', 'Corrections', 'Support'],
  );
});

test('Rooms does not list the primary axes as ordinary rooms', () => {
  const roomFamilies = ['read', 'trust', 'participate'] as const;
  const roomPaths = roomFamilies.flatMap((family) =>
    semanticDestinationsInFamily(family).map((destination) => destination.path),
  );
  for (const axis of primaryAxes()) {
    assert.ok(!roomPaths.includes(axis.path), `${axis.path} is an axis, not a room card`);
  }
});

test('a non-public destination is never browsable', () => {
  for (const destination of destinations) {
    if (destination.isPublic) continue;
    assert.equal(destination.browsable, false, `${destination.id} is private but browsable`);
  }
});

test('path normalization ignores trailing slashes, queries and fragments', () => {
  assert.equal(normalizeDestinationPath('/stories/'), '/stories');
  assert.equal(normalizeDestinationPath('/stories?kind=chapter'), '/stories');
  assert.equal(normalizeDestinationPath('/stories#top'), '/stories');
  assert.equal(normalizeDestinationPath('/'), '/');
  assert.equal(normalizeDestinationPath(''), '/');
  assert.equal(semanticDestinationByPath('/records/')?.id, 'records');
});
