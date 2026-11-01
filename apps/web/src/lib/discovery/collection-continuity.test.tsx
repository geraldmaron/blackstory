import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicEntityView } from '../../data/public-seed';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import { toDoorLinkPins } from '../map-experience/first-paint-pins';
import { listPublicEntities } from '../../data/public-seed';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import {
  buildRecordsIndex,
  findRecordsNeighbors,
  parseRecordsQuery,
} from '../records/build-records-index';
import { buildAtlasShell } from '../../app/explore/explore-view-model';
import { buildAtlasCatalogPayload } from '../../app/explore/atlas-catalog';
import {
  assembleExploreViewModel,
  firstPaintCatalog,
  hydrateExploreViewModel,
} from '../../app/explore/explore-view-model-wire';
import { useLensFilters } from '../../app/explore/hooks/use-lens-filters';
import { exploreHrefFromLens } from '../../app/explore/hooks/use-explore-url-sync';
import {
  discoveryFromExplore,
  discoveryFromSearchParams,
  placeArrivalQuery,
  placeDiscoveryReturn,
} from './discovery-state';
import { normalizeQueryString } from '../runtime-hardening/query-normalization';
import { recordsQueryFromExplore } from './explore-collection';
import { mapListContinuityLabel } from './continuity-label';

const bag = (href: string) =>
  Object.fromEntries(new URL(href, 'https://example.test').searchParams);
const seed = listPublicEntities()[0]!;
const entities = [
  {
    ...seed,
    id: 'continuity-z',
    displayName: 'Zulu School',
    kind: 'school',
    summary: 'Shared needle in the summary.',
    eraBuckets: ['1920s'],
    jurisdictionLabel: 'Oklahoma',
    locationLabel: 'Tulsa',
    geoAnchor: { lat: 36.15, lng: -95.99, geohash: '9y7', matchMethod: 'release_projection' },
  },
  {
    ...seed,
    id: 'continuity-a',
    displayName: 'Alpha School',
    kind: 'school',
    summary: 'Shared needle in the summary.',
    eraBuckets: ['1920s'],
    jurisdictionLabel: 'Oklahoma',
    locationLabel: 'Tulsa',
    geoAnchor: undefined,
  },
  {
    ...seed,
    id: 'continuity-church',
    displayName: 'Church',
    kind: 'church',
    summary: 'Shared needle in the summary.',
    eraBuckets: ['1920s'],
    jurisdictionLabel: 'Oklahoma',
  },
  {
    ...seed,
    id: 'continuity-other',
    displayName: 'Other School',
    kind: 'school',
    summary: 'Different material.',
    eraBuckets: ['1920s'],
    jurisdictionLabel: 'Oklahoma',
  },
].map((entity) => {
  const { geoAnchor, ...rest } = entity;
  return (geoAnchor ? { ...rest, geoAnchor } : rest) as PublicEntityView;
});

for (const sort of ['discovery', 'era', 'name', 'evidence']) {
  test(`Records → live Door browse → record → return preserves matches and ${sort} order`, () => {
    const query = parseRecordsQuery({
      q: 'Shared   needle',
      kind: 'school',
      era: '1920s',
      state: 'ok',
      sort,
    });
    const records = buildRecordsIndex(entities, query);
    assert.equal(records.totalMatched, 2);
    const { shell } = buildAtlasShell(bag(records.atlasHref), entities);
    const catalog = buildAtlasCatalogPayload(
      entities,
      getHistoryGraphReleaseArtifact(entities),
      {},
      'none',
    );
    // AtlasLoader first mounts the shell with Door's pins, then receives the full catalog.
    for (const payload of [
      firstPaintCatalog(toDoorLinkPins(catalog.source.featureCollection.features), 'none'),
      catalog,
    ]) {
      const view = hydrateExploreViewModel(assembleExploreViewModel(shell, payload));
      let captured: ReturnType<typeof useLensFilters> | undefined;
      function Lens() {
        captured = useLensFilters(view, {
          toasts: [],
          show() {},
          dismiss() {},
          runLatestAction() {},
        });
        return null;
      }
      renderToStaticMarkup(<Lens />);
      const lens = captured!;
      assert.equal(lens.collectionMatched, 2);
      assert.deepEqual(
        lens.filtered.map((feature) => feature.properties.entityId),
        [payload.collectionFacts ? 'continuity-z' : 'pin-0'],
      );
      assert.equal(lens.collectionState.filters.kind, 'school');
      assert.equal(lens.collectionState.filters.era, '1920s');
      assert.equal(
        mapListContinuityLabel(lens.collectionMatched, lens.filtered.length),
        '2 records match. 1 appear on the map.',
      );
      assert.deepEqual(
        buildRecordsIndex(entities, recordsQueryFromExplore(lens.collectionState)).rows.map(
          (row) => row.id,
        ),
        records.rows.map((row) => row.id),
      );
      const synced = exploreHrefFromLens(view.viewState, {
        ...lens,
        collectionState: lens.collectionState,
        satellite: false,
        lines: false,
        selectedId: undefined,
      });
      const discovery = discoveryFromExplore(lens.collectionState);
      const arrival = placeArrivalQuery(discovery, 'map');
      const canonicalArrival = normalizeQueryString(
        '/place/zulu-school',
        bag('/place/zulu-school?' + arrival),
      );
      const returned = placeDiscoveryReturn(
        'continuity-z',
        discoveryFromSearchParams(bag('/place/zulu-school?' + canonicalArrival)),
      );
      assert.deepEqual(parseRecordsQuery(bag(returned.listHref)), query);
      assert.equal(bag(synced).q, query.q);
      assert.equal(bag(returned.mapHref).q, query.q);
      assert.equal(bag(returned.mapHref).sort ?? 'discovery', sort);
      const neighbors = findRecordsNeighbors(entities, query, records.rows[0]!.id, arrival);
      assert.equal(neighbors?.next?.id, records.rows[1]!.id);
    }
    const noMatch = buildAtlasShell(
      { ...bag(records.atlasHref), q: 'not in this archive' },
      entities,
    );
    assert.equal(noMatch.shell.totalMatched, 0);
    assert.deepEqual(noMatch.noscriptFeatures, []);
    const panned = buildAtlasShell(
      { ...bag(records.atlasHref), lat: '10', lng: '20', zoom: '3' },
      entities,
    );
    assert.deepEqual(panned.shell.initialMatchIndexes, shell.initialMatchIndexes);
  });
}

test('Explore parser normalizes text and supported sort and keeps crawl guards', () => {
  assert.equal(
    normalizeQueryString('/explore', { q: '  a   school  ', sort: 'NAME' }),
    'q=a+school&sort=name',
  );
  assert.equal(
    normalizeQueryString('/explore', { q: 'x'.repeat(150), sort: 'unknown' }),
    'q=' + 'x'.repeat(120),
  );
  assert.equal(
    buildRecordsIndex(entities, parseRecordsQuery({ q: 'needle', sort: 'name' })).indexable,
    false,
  );
});

test('first-paint match indexes use the cached Door plate ordering', () => {
  const catalog = buildAtlasCatalogPayload(
    entities,
    getHistoryGraphReleaseArtifact(entities),
    {},
    'none',
  );
  const cachedFeatures = [...catalog.source.featureCollection.features].reverse();
  const pins = toDoorLinkPins(cachedFeatures);
  const { shell } = buildAtlasShell(
    { q: 'Shared needle', kind: 'school' },
    entities,
    'none',
    cachedFeatures,
  );
  const firstPaint = hydrateExploreViewModel(
    assembleExploreViewModel(shell, firstPaintCatalog(pins, 'none')),
  );
  assert.deepEqual(
    firstPaint.filteredFeatures.map((feature) => feature.properties.displayName),
    ['Zulu School'],
  );
  const expectedIndex = cachedFeatures.findIndex(
    (feature) => feature.properties.entityId === 'continuity-z',
  );
  assert.equal(firstPaint.filteredFeatures[0]?.properties.entityId, `pin-${expectedIndex}`);
  assert.doesNotMatch(JSON.stringify(shell), /continuity-z|continuity-a/);
});

test('catalog cache version is bounded and uses the first value', () => {
  assert.equal(normalizeQueryString('/atlas/catalog', { v: '3' }), 'v=3');
  assert.equal(normalizeQueryString('/atlas/catalog', { v: 'garbage' }), '');
  assert.equal(normalizeQueryString('/atlas/catalog', { v: '999' }), '');
  assert.equal(normalizeQueryString('/atlas/catalog', { v: ['3', '999'] }), 'v=3');
  assert.equal(normalizeQueryString('/atlas/catalog', { v: ['999', '3'] }), '');
});

test('Records and Map use the same slim release projection and map eligibility', () => {
  const projections = entities.slice(0, 2).map((entity, index) => ({
    ...entity,
    summary: 'Different full-entity wording.',
    geoAnchor: { lat: 36.15 + index, lng: -95.99, geohash: '9y7', matchMethod: 'release_projection' },
  }));
  const docs = projections.map((entity, index) => ({
    id: entity.id, releaseId: 'rel_fixture', kind: entity.kind,
    displayName: entity.displayName, nameLower: entity.displayName.toLowerCase(), aliases: [],
    summary: 'Needle in the released search projection.', topicTags: [], eraBuckets: ['1920s'],
    notabilityBasis: [], notabilityLabels: [], recordMaturity: 'partial_enrichment',
    researchCoverage: 'partial', relatedCount: 0, claimCount: 1,
    evidenceInputs: { strongestClaimLevel: 'high', citedLineageKeys: [], evidenceLineageKeys: [] },
    jurisdictionState: 'Oklahoma', ...(index === 0 ? { geohash: '9y7' } : {}),
  } satisfies PublicSearchIndexDoc));
  const query = parseRecordsQuery({ q: 'needle', sort: 'name' });
  const records = buildRecordsIndex(docs, query);
  assert.equal(buildRecordsIndex(projections, query).totalMatched, 0);
  const catalog = buildAtlasCatalogPayload(projections, getHistoryGraphReleaseArtifact(projections), {}, 'none', docs);
  const { shell } = buildAtlasShell(bag(records.atlasHref), projections, 'none', catalog.source.featureCollection.features, docs);
  for (const payload of [firstPaintCatalog(toDoorLinkPins(catalog.source.featureCollection.features), 'none'), catalog]) {
    const view = hydrateExploreViewModel(assembleExploreViewModel(shell, payload));
    assert.equal(view.totalMatched, records.totalMatched);
    assert.equal(view.filteredFeatures.length, records.mappableMatched);
    assert.equal(view.totalMatched, 2);
    assert.equal(view.filteredFeatures.length, 1);
  }
});

test('Records counts only eligible matches emitted by the current map plate', () => {
  const query = parseRecordsQuery({ q: 'needle' });
  const index = buildRecordsIndex(entities, query, new Set());
  assert.ok(index.totalMatched > 0);
  assert.equal(index.mappableMatched, 0);
});
