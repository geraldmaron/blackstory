/**
 * Confirms the explore page view-model: every active-release entity with a geo anchor
 * appears, era filters use decade buckets, and default filters never silently hide records.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { buildExploreViewModel } from './explore-view-model';

test('includes every geo-anchored active-release entity by default', () => {
  const view = buildExploreViewModel({});
  assert.equal(view.filteredFeatures.length, listPublicEntities().length);
  assert.equal(view.totalMatched, listPublicEntities().length);
});

test('era filter uses decade bucket labels from entity eraBuckets', () => {
  const view = buildExploreViewModel({});
  const eraValues = view.facetOptions.era.map((option) => option.value);
  assert.ok(eraValues.includes('1840s'));
  assert.ok(eraValues.includes('1970s'));
});

test('filtering by era reduces results without hiding unmatched entities silently', () => {
  const all = buildExploreViewModel({});
  const seventies = buildExploreViewModel({ era: '1970s' });
  assert.ok(seventies.totalMatched < all.totalMatched);
  for (const feature of seventies.filteredFeatures) {
    assert.ok(feature.properties.eraBuckets.includes('1970s'));
  }
});

test('parses shareable URL viewport and layer model state', () => {
  const view = buildExploreViewModel({
    lat: '38.9072',
    lng: '-77.0369',
    zoom: '11.5',
    layerMode: 'presence',
    selected: 'ent_15th_st_church_001',
  });
  assert.ok(view.viewState.viewport);
  assert.equal(view.viewState.viewport!.lat, 38.9072);
  assert.equal(view.viewState.layerMode, 'presence');
  assert.equal(view.viewState.selected, 'ent_15th_st_church_001');
  assert.equal(view.viewState.lines, false);
});

test('legacy density=1 deep links still open presence layer', () => {
  const view = buildExploreViewModel({ density: '1' });
  assert.equal(view.viewState.layerMode, 'presence');
});

test('lines=1 projects evidence-backed history edges onto the map', () => {
  const view = buildExploreViewModel({ lines: '1' }, relationshipFixtures());
  assert.equal(view.viewState.lines, true);
  assert.ok(view.availableDecades.length > 0);
  assert.ok(view.historyEdges.length > 0);
  assert.equal(view.edgeLineCollection.features.length, view.historyEdges.length);
});

test('decade slice filters relationship lines', () => {
  const allTime = buildExploreViewModel({ lines: '1' }, relationshipFixtures());
  const fifties = buildExploreViewModel({ lines: '1', decade: '1950s' }, relationshipFixtures());
  assert.ok(fifties.historyEdges.length <= allTime.historyEdges.length);
});

test('lines=1 draws connections from live geoAnchor outside the seed table', () => {
  // Regression: Explore showed "0 connections" for the national catalog because
  // buildHistoryEdgeLineCollection only consulted ENTITY_GEO_ANCHORS (Dunbar seed).
  const [church, school] = listPublicEntities();
  assert.ok(church && school);
  const liveEntities = [
    {
      ...church,
      id: 'ent_live_catalog_place_a',
      claims: [
        {
          id: 'live-relationship-claim',
          predicate: 'located_at',
          object: 'ent_live_catalog_place_b',
          confidenceLevel: 'high' as const,
          citationSource: 'fixture-archive',
          citationLabel: 'Synthetic relationship fixture',
          citationHref: 'https://archive.example.org/relationship',
        },
      ],
      relatedIds: ['ent_live_catalog_place_b'],
      related: [
        { id: 'ent_live_catalog_place_b', type: 'located_at', direction: 'outgoing' as const },
      ],
      geoAnchor: {
        lat: 33.75,
        lng: -84.39,
        geohash: 'dj',
        matchMethod: 'release_projection',
      },
    },
    {
      ...school,
      id: 'ent_live_catalog_place_b',
      relatedIds: ['ent_live_catalog_place_a'],
      related: [
        { id: 'ent_live_catalog_place_a', type: 'located_at', direction: 'incoming' as const },
      ],
      geoAnchor: {
        lat: 29.76,
        lng: -95.37,
        geohash: '9v',
        matchMethod: 'release_projection',
      },
    },
  ];
  const view = buildExploreViewModel({ lines: '1' }, liveEntities);
  assert.equal(view.viewState.lines, true);
  assert.ok(view.historyEdges.length > 0);
  assert.ok(view.edgeLineCollection.features.length > 0);
  assert.equal(
    view.edgeLineCollection.features[0]?.properties.fromEntityId === 'ent_live_catalog_place_a' ||
      view.edgeLineCollection.features[0]?.properties.toEntityId === 'ent_live_catalog_place_a',
    true,
  );
});

function relationshipFixtures(): readonly PublicEntityView[] {
  const [first, second] = listPublicEntities();
  return [
    {
      ...first!,
      related: [{ id: second!.id, type: 'related_to', direction: 'outgoing' }],
      claims: [
        {
          id: 'projection-relationship-claim',
          predicate: 'related_to',
          object: second!.id,
          confidenceLevel: 'high',
          citationSource: 'fixture-archive',
          citationLabel: 'Synthetic relationship fixture',
          citationHref: 'https://archive.example.org/relationship',
        },
      ],
    },
    { ...second!, related: [], claims: [] },
  ];
}

test('map connection lines stay empty when relationship proof is missing', () => {
  const entities = relationshipFixtures().map((entity) => ({ ...entity, claims: [] }));
  const view = buildExploreViewModel({ lines: '1' }, entities);
  assert.deepEqual(view.historyEdges, []);
  assert.deepEqual(view.edgeLineCollection.features, []);
});
