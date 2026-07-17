/**
 * SSR markup smoke tests for the BB-090 kind-appropriate status panel (BB-052 acceptance criterion
 * 5). Covers the three shapes it must render: a place/school/institution's status + full
 * statusHistory record, an event's when-span (never active/historic), and the approved gap
 * notice for a status-eligible kind that happens to carry no history.
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
  const school = requireEntity('ent_seed_school_001');
  const html = renderToStaticMarkup(createElement(EntityStatusPanel, { entity: school, framing: 'present_day' }));
  assert.match(html, /Active/);
  assert.match(html, /Historic/);
  assert.match(html, /1868/);
  assert.match(html, /1954/);
  assert.match(html, /Present-day record/);
});

test('renders an eventWindow panel (never active/historic) for an event kind', () => {
  const event = requireEntity('ent_seed_event_001');
  const html = renderToStaticMarkup(createElement(EntityStatusPanel, { entity: event, framing: 'historical' }));
  assert.match(html, /When this happened/);
  assert.match(html, /1954/);
  assert.doesNotMatch(html, />Active</);
  assert.doesNotMatch(html, />Historic</);
});

test('renders the approved statusHistory gap notice when a place-like kind has none', () => {
  const school = requireEntity('ent_seed_school_001');
  const { status: _status, statusHistory: _statusHistory, ...withoutHistory } = school;
  const html = renderToStaticMarkup(createElement(EntityStatusPanel, { entity: withoutHistory, framing: 'historical' }));
  assert.match(html, /No status history recorded/);
});
