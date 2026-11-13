/**
 * The spotlight callout stays inside the uncovered map window, which is what keeps it off the
 * headline: right of the pin first, then left, above, below, and hidden when nothing fits.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeCallout } from './door-spotlight-callout';

const WINDOW = { left: 536, top: 56, right: 1440, bottom: 900 };
const CARD = { width: 264, height: 150 };

test('the card sits right of the pin when there is room, with a horizontal leader', () => {
  const placed = placeCallout({ x: 800, y: 400 }, CARD, WINDOW);
  assert.ok(placed);
  assert.equal(placed.side, 'right');
  assert.equal(placed.left, 824);
  assert.equal(placed.leader.height, 1);
  assert.equal(placed.leader.left, 800);
});

test('near the right edge the card flips to the left of the pin', () => {
  const placed = placeCallout({ x: 1300, y: 400 }, CARD, WINDOW);
  assert.ok(placed);
  assert.equal(placed.side, 'left');
  assert.ok(placed.left + CARD.width <= 1300);
});

test('a pin outside the window, under the dock, gets no callout at all', () => {
  assert.equal(placeCallout({ x: 300, y: 700 }, CARD, WINDOW), null);
  assert.equal(placeCallout({ x: 800, y: 20 }, CARD, WINDOW), null);
});

test('a narrow phone window stacks the card above or below the pin', () => {
  const phone = { left: 0, top: 48, right: 390, bottom: 560 };
  const placed = placeCallout({ x: 195, y: 400 }, { width: 224, height: 100 }, phone);
  assert.ok(placed);
  assert.equal(placed.side, 'above');
  assert.equal(placed.leader.width, 1);
  const high = placeCallout({ x: 195, y: 120 }, { width: 224, height: 100 }, phone);
  assert.ok(high);
  assert.equal(high.side, 'below');
});

test('a card that cannot fit anywhere inside the window is hidden, never overlapped', () => {
  const tiny = { left: 0, top: 0, right: 200, bottom: 120 };
  assert.equal(placeCallout({ x: 100, y: 60 }, CARD, tiny), null);
});

test('on a phone the card docks under the country, at the window foot, never beside the pin', () => {
  const phone = { left: 0, top: 48, right: 390, bottom: 560 };
  const card = { width: 200, height: 44 };
  assert.equal(placeCallout({ x: 60, y: 300 }, card, phone)?.side, 'right');
  const docked = placeCallout({ x: 60, y: 300 }, card, phone, true);
  assert.ok(docked);
  assert.equal(docked.side, 'below');
  assert.equal(docked.top, 560 - 16 - 44);
  assert.equal(docked.leader.top + docked.leader.height, docked.top);
  // A pin already near the foot takes the card above it instead.
  assert.equal(placeCallout({ x: 60, y: 520 }, card, phone, true)?.side, 'above');
});

test('the card takes the side of its pin with the most free map, not the first that fits', () => {
  // Groups crowd the right of the pin; the left is open water.
  const groups = [
    { left: 1030, top: 360, right: 1070, bottom: 400 },
    { left: 1100, top: 420, right: 1140, bottom: 460 },
    { left: 1180, top: 380, right: 1220, bottom: 420 },
  ];
  const placed = placeCallout({ x: 1000, y: 400 }, CARD, WINDOW, false, groups);
  assert.equal(placed?.side, 'left');
  // With nothing in the way, reading order still puts it on the right.
  assert.equal(placeCallout({ x: 1000, y: 400 }, CARD, WINDOW, false, [])?.side, 'right');
});
