/**
 * SSR markup smoke tests for the kind-appropriate status panel. Covers the three shapes it
 * must render: a place/school/institution's status + full statusHistory record, an event's
 * when-span (never active/historic), and the approved gap notice for a status-eligible kind that
 * happens to carry no history.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { getPublicEntity } from '../../data/public-seed';
import { EntityStatusPanel } from './EntityStatusPanel';

function requireEntity(id: string) {
  const entity = getPublicEntity(id);
  assert.ok(entity, `expected seed fixture ${id} to exist`);
  return entity;
}

test('renders the current status and full time-scoped statusHistory for a place-like kind', () => {
  const school = requireEntity('ent_dunbar_school_001');
  const html = renderToStaticMarkup(
    createElement(EntityStatusPanel, { entity: school, framing: 'present_day' }),
  );
  assert.match(html, /Current status/);
  assert.match(html, /ds-status-mark/);
  assert.match(html, /ds-status-mark__icon/);
  assert.match(html, /aria-label="Status: active"/);
  assert.match(html, /Active/);
  assert.match(html, /Historic/);
  assert.match(html, /1870/);
  assert.match(html, /1891/);
  // Framing badge lives on the entity mast — do not repeat it here.
  assert.doesNotMatch(html, /Present-day record/);
});

test('renders an eventWindow panel (never active/historic) for an event kind', () => {
  const event = requireEntity('ent_dc_landmark_listing_1975');
  const html = renderToStaticMarkup(
    createElement(EntityStatusPanel, { entity: event, framing: 'historical' }),
  );
  assert.match(html, /1975/);
  assert.match(html, /when-span is authoritative/);
  assert.doesNotMatch(html, />Active</);
  assert.doesNotMatch(html, />Historic</);
});

test('renders the approved statusHistory gap notice when a place-like kind has none', () => {
  const school = requireEntity('ent_dunbar_school_001');
  const { status: _status, statusHistory: _statusHistory, ...withoutHistory } = school;
  const html = renderToStaticMarkup(
    createElement(EntityStatusPanel, { entity: withoutHistory, framing: 'historical' }),
  );
  assert.match(html, /No status history recorded/);
});
