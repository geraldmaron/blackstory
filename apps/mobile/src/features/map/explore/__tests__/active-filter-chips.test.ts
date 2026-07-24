/**
 * Unit tests for active Explore filter chip helpers.
 */
import { buildExploreFacetOptions } from '@/features/explore/explore-filter';
import { makeFeature } from '@/features/explore/__fixtures__/features';
import { activeFilterChips, activeFilterCount, clearFilterKey } from '../active-filter-chips';

const FACETS = buildExploreFacetOptions([
  makeFeature('a', [-77.04, 38.9], {
    label: 'Alpha',
    kind: 'place',
    properties: {
      eraBuckets: ['1950s'],
      mapTone: 'plantation',
      topicIds: ['education'],
      status: 'historic',
      confidenceTier: 'high',
      statePostalCode: 'DC',
    } as never,
  }),
]);

describe('activeFilterChips', () => {
  it('returns empty when no filters are set', () => {
    expect(activeFilterChips({}, FACETS)).toEqual([]);
    expect(activeFilterCount({})).toBe(0);
  });

  it('builds removable chips with icons for kind and era', () => {
    const chips = activeFilterChips({ kind: 'places', era: '1950s' }, FACETS);
    expect(chips).toEqual([
      { key: 'kind', label: 'Places', iconName: 'place' },
      { key: 'era', label: '1950s', iconName: 'history' },
    ]);
    expect(activeFilterCount({ kind: 'places', era: '1950s', tone: 'plantation' })).toBe(3);
  });

  it('clearFilterKey drops one facet', () => {
    expect(clearFilterKey({ kind: 'places', era: '1950s' }, 'kind')).toEqual({ era: '1950s' });
  });
});
