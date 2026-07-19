/**
 * Confirms Explore panel chrome class hooks for hide/show rails stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exploreFiltersPanelClassName, exploreResultsPanelClassName } from './explore-panel-chrome';

test('filters panel class reflects visible vs hidden state', () => {
  assert.equal(exploreFiltersPanelClassName({ visible: true }), 'ds-explore-stage__filters');
  assert.equal(
    exploreFiltersPanelClassName({ visible: false }),
    'ds-explore-stage__filters ds-explore-stage__filters--hidden',
  );
});

test('results panel class combines hidden and dimmed modifiers independently', () => {
  assert.equal(
    exploreResultsPanelClassName({ visible: true, dimmed: false }),
    'ds-explore-stage__results',
  );
  assert.equal(
    exploreResultsPanelClassName({ visible: false, dimmed: false }),
    'ds-explore-stage__results ds-explore-stage__results--hidden',
  );
  assert.equal(
    exploreResultsPanelClassName({ visible: true, dimmed: true }),
    'ds-explore-stage__results ds-explore-stage__results--dimmed',
  );
});
