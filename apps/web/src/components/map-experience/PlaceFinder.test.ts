/**
 * PlaceFinder: SSR markup smoke test for the wide (default, pre-mount) posture, plus unit tests
 * for the radius/state disagreement rule those two are pure functions specifically so this file
 * does not need a DOM to pin the acceptance criterion (repo-92n2.14): "Radius and state select
 * disagreement resolves to the most recent action with the other control visibly cleared."
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { PlaceFinder, radiusPickClearsState, statePickClearsRadius } from './PlaceFinder';

test('renders the full form inline, privacy notice first, before any permission is requested', () => {
  const html = renderToStaticMarkup(
    createElement(PlaceFinder, { state: '', onStateChange: () => {} }),
  );
  // Privacy notice content (`LocationPrivacyNotice`), ahead of the consent button in source
  // order — full length, not the collapsed one-line summary a reader would have to expand.
  const privacyIndex = html.indexOf('How this lookup uses your location');
  const consentIndex = html.indexOf('Use my current location');
  assert.ok(privacyIndex >= 0, 'privacy notice not found');
  assert.ok(consentIndex >= 0, 'consent button not found');
  assert.ok(privacyIndex < consentIndex, 'privacy notice must precede the consent button');
  assert.match(html, /Census Bureau|U\.S\. Census Geocoder/);

  // The remounted ExploreAddressSearch: address field and radius chips.
  assert.match(html, /Record, city, state, or ZIP/);
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-checked="true"[^>]*>All</);

  // No sheet chrome and no narrow trigger — SSR (and the pre-mount client render) is always the
  // wide inline posture, corrected after mount the same way `use-panel-visibility.ts` is.
  assert.equal(html.includes('role="dialog"'), false);
  assert.equal(html.includes('Find a place'), false);
});

test('the consent button never fires a geolocation call on render (no click, no effect)', () => {
  // `renderToStaticMarkup` never runs effects, so this is really asserting the render body
  // itself has no code path that reaches `navigator.geolocation` — the button starts idle.
  const html = renderToStaticMarkup(
    createElement(PlaceFinder, { state: '', onStateChange: () => {} }),
  );
  assert.match(html, />Use my current location</);
  assert.doesNotMatch(html, />Requesting location…</);
});

test('picking a non-all radius clears an active state, but only when one is active', () => {
  assert.equal(radiusPickClearsState('10mi', 'GA'), true);
  assert.equal(radiusPickClearsState('10mi', ''), false, 'nothing to clear');
  assert.equal(radiusPickClearsState('all', 'GA'), false, 'All is not a disagreement');
});

test('picking a state clears an active radius, but leaves All alone', () => {
  assert.equal(statePickClearsRadius('GA', '10mi'), 'all');
  assert.equal(statePickClearsRadius('GA', 'all'), 'all', 'already All: no-op');
  assert.equal(statePickClearsRadius('', '10mi'), '10mi', 'clearing state is not a state pick');
});
