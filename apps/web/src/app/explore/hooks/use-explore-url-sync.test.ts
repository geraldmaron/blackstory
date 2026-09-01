/**
 * exploreHrefFromLens — Lens → shareable /explore URL (floor, state, kind, theme).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EXPLORE_FILTERS } from '../../../lib/map-experience/filters';
import { defaultExploreOverlayState } from '../../../lib/map-experience/url-state';
import { exploreHrefFromLens } from './use-explore-url-sync';

describe('exploreHrefFromLens', () => {
  const base = {
    filters: { ...DEFAULT_EXPLORE_FILTERS },
    ...defaultExploreOverlayState(),
  };

  it('writes floor when the Lens evidence floor is set', () => {
    const href = exploreHrefFromLens(base, {
      stateCode: '',
      kindFamily: null,
      evidenceFloor: 'B',
      topicId: null,
      status: null,
      layerMode: 'presence',
      satellite: false,
      selectedId: undefined,
    });
    assert.equal(href.includes('floor=B'), true);
  });

  it('omits floor when the Lens is open to any grade', () => {
    const href = exploreHrefFromLens(base, {
      stateCode: 'DC',
      kindFamily: 'place',
      evidenceFloor: 'any',
      topicId: 'abolition',
      status: null,
      layerMode: 'presence',
      satellite: false,
      selectedId: 'ent_dunbar_school_001',
    });
    assert.equal(href.includes('floor='), false);
    assert.equal(href.includes('state=DC'), true);
    assert.equal(href.includes('kind=place'), true);
    assert.equal(href.includes('theme=abolition'), true);
    assert.equal(href.includes('selected=ent_dunbar_school_001'), true);
    assert.equal(href.includes('lat='), false);
  });
});
