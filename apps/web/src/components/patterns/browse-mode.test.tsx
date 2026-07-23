/**
 * Unit tests for shared browse-mode helpers and record browse controls markup.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrowseModeToggle } from './BrowseModeToggle';
import { RecordBrowseControls } from './RecordBrowseControls';
import {
  formatBrowsePosition,
  initialBrowseIndex,
  pickRandomIndex,
  stepIndex,
} from './browse-mode';
import { buildHomeFeaturedCarouselSet } from './home-featured-set';
import { listPublicEntities } from '../../data/public-seed';

void React;

describe('browse-mode helpers', () => {
  it('steps ordered indices with wraparound', () => {
    assert.equal(stepIndex(0, 1, 4), 1);
    assert.equal(stepIndex(3, 1, 4), 0);
    assert.equal(stepIndex(0, -1, 4), 3);
  });

  it('picks a different random index when more than one record exists', () => {
    assert.equal(pickRandomIndex({ current: 2, total: 4, randomIndex: () => 0 }), 0);
    assert.equal(pickRandomIndex({ current: 0, total: 1 }), 0);
  });

  it('formats ordered and random position labels', () => {
    assert.equal(formatBrowsePosition(1, 4, 'ordered'), '2 / 4');
    assert.equal(formatBrowsePosition(1, 4, 'random'), 'Random · 4 records');
    assert.equal(formatBrowsePosition(0, 1, 'random'), 'Random · 1 record');
  });

  it('picks a valid initial browse index', () => {
    assert.equal(initialBrowseIndex(0), 0);
    assert.equal(initialBrowseIndex(1), 0);
    assert.equal(initialBrowseIndex({ total: 5, randomIndex: () => 3 }), 3);
    assert.equal(initialBrowseIndex({ total: 5, randomIndex: () => 0 }), 0);
  });
});

describe('BrowseModeToggle', () => {
  it('renders segmented ordered/random controls with pressed state', () => {
    const html = renderToStaticMarkup(
      <BrowseModeToggle mode="random" onModeChange={() => {}} />,
    );
    assert.match(html, /aria-label="Browse mode"/);
    assert.match(html, /aria-pressed="false"/);
    assert.match(html, />Ordered</);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, />Random</);
    assert.match(html, /ds-browse-mode-toggle/);
  });
});

describe('RecordBrowseControls', () => {
  it('renders nav, toggle, dots, and ordered position counter', () => {
    const html = renderToStaticMarkup(
      <RecordBrowseControls
        total={4}
        index={1}
        mode="ordered"
        onModeChange={() => {}}
        onPrevious={() => {}}
        onNext={() => {}}
        onGoTo={() => {}}
        itemIds={['a', 'b', 'c', 'd']}
      />,
    );
    assert.match(html, /aria-label="Browse records"/);
    assert.match(html, /aria-label="Next record in list"/);
    assert.match(html, /2 \/ 4/);
    assert.match(html, /ds-record-browse__dot/);
  });

  it('shows random affordance copy when random mode is active', () => {
    const html = renderToStaticMarkup(
      <RecordBrowseControls
        total={12}
        index={3}
        mode="random"
        onModeChange={() => {}}
        onPrevious={() => {}}
        onNext={() => {}}
      />,
    );
    assert.match(html, /Random · 12 records/);
    assert.match(html, /aria-label="Next random record"/);
    assert.doesNotMatch(html, /ds-record-browse__dot/);
  });
});

describe('buildHomeFeaturedCarouselSet', () => {
  it('includes every release entity with curated ids first', () => {
    const entities = listPublicEntities();
    const featured = buildHomeFeaturedCarouselSet(entities, [
      'ent_15th_st_church_001',
      'ent_dunbar_school_001',
    ]);
    assert.equal(featured.length, entities.length);
    assert.equal(featured[0]?.id, 'ent_15th_st_church_001');
    assert.equal(featured[1]?.id, 'ent_dunbar_school_001');
  });
});
