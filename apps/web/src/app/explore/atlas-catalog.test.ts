/**
 * The shell/catalog split must be lossless: page shell + catalog payload reassembled on the client
 * is the same serializable view model the server used to render in one piece. And the catalog
 * must be cacheable by the CDN, which is the entire point of the split.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { listPublicEntities } from '../../data/public-seed';
import {
  ATLAS_CATALOG_CACHE_CONTROL,
  ATLAS_CATALOG_PATH,
  buildAtlasCatalogPayload,
} from './atlas-catalog';
import { buildAtlasShell, buildExploreViewModel } from './explore-view-model';
import {
  assembleExploreViewModel,
  toAtlasShellModel,
  toSerializableExploreViewModel,
} from './explore-view-model-wire';

const entities = listPublicEntities();
const artifact = getHistoryGraphReleaseArtifact(entities);

test('shell + catalog reassembles to exactly the one-piece serializable view model', () => {
  for (const raw of [
    {},
    { lines: '1' },
    { lines: '1', decade: '1950s' },
    { era: '1970s', state: 'DC' },
    { kind: 'person', selected: 'ent_15th_st_church_001' },
  ]) {
    const onePiece = toSerializableExploreViewModel(
      buildExploreViewModel(raw, entities, 'none', artifact, {}),
    );
    const { shell } = buildAtlasShell(raw, entities, 'none');
    const catalog = buildAtlasCatalogPayload(entities, artifact, {}, 'none');
    assert.deepEqual(
      assembleExploreViewModel(shell, catalog),
      onePiece,
      `params ${JSON.stringify(raw)}`,
    );
    // And the shell is the view model minus the catalog, nothing more.
    assert.deepEqual(
      shell,
      toAtlasShellModel(buildExploreViewModel(raw, entities, 'none', artifact, {})),
    );
  }
});

test('the shell carries no catalog: no features, no edges', () => {
  const { shell } = buildAtlasShell({}, entities, 'none');
  const keys = Object.keys(shell);
  for (const heavy of ['source', 'edgeLineCatalog', 'historyEdges', 'edgeLineCollection']) {
    assert.ok(!keys.includes(heavy), `shell must not carry ${heavy}`);
  }
});

test('map features do not carry notabilityLabels (rubric sentences repeated per record)', () => {
  const catalog = buildAtlasCatalogPayload(entities, artifact, {}, 'none');
  for (const feature of catalog.source.featureCollection.features) {
    assert.ok(!('notabilityLabels' in feature.properties));
  }
});

test('the catalog is CDN-cacheable and served from a fixed path', () => {
  assert.equal(ATLAS_CATALOG_PATH, '/atlas/catalog');
  assert.match(ATLAS_CATALOG_CACHE_CONTROL, /\bpublic\b/);
  assert.match(ATLAS_CATALOG_CACHE_CONTROL, /s-maxage=\d+/);
  assert.match(ATLAS_CATALOG_CACHE_CONTROL, /stale-while-revalidate=\d+/);
  assert.doesNotMatch(ATLAS_CATALOG_CACHE_CONTROL, /no-store|private/);
});

test('the Atlas page never puts the catalog back in the initial prop', async () => {
  const { readFileSync } = await import('node:fs');
  const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');
  const atlasHome = readFileSync(new URL('../atlas-home.tsx', import.meta.url), 'utf8');
  const pageImports = pageSource
    .split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
  assert.doesNotMatch(pageSource, /toSerializableExploreViewModel/);
  assert.doesNotMatch(pageSource, /buildExploreViewModelAsync/);
  assert.doesNotMatch(pageImports, /AtlasLoader|getSharedPublicEntities/);
  assert.match(pageSource, /wantsAtlasInstrument/);
  assert.match(pageSource, /HomeFirstPaint/);
  assert.match(atlasHome, /AtlasLoader/);
});
