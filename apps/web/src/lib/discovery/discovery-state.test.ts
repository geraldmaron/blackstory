/**
 * DiscoveryState adapters and map/list continuity — v10.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeQueryString } from '../runtime-hardening/query-normalization';
import { parseExploreSearchParams } from '../map-experience/url-state';
import {
  discoveryFromExplore,
  discoveryFromRecords,
  discoveryFromSearchParams,
  listHrefFromDiscovery,
  mapHrefFromDiscovery,
  placeArrivalQuery,
  placeDiscoveryReturn,
} from './discovery-state';
import { EMPTY_RECORDS_QUERY, buildAtlasHref } from '../records/build-records-index';

describe('DiscoveryState map/list continuity', () => {
  it('round-trips Records narrowing onto Explore including evidence floor', () => {
    const records = {
      ...EMPTY_RECORDS_QUERY,
      kind: 'place',
      era: '1920s',
      state: 'OK',
      topic: 'abolition',
      status: 'historic',
      evidence: 'B',
    };
    const discovery = discoveryFromRecords(records);
    const href = mapHrefFromDiscovery(discovery);
    assert.equal(href.includes('kind=place'), true);
    assert.equal(href.includes('era=1920s'), true);
    assert.equal(href.includes('state=OK'), true);
    assert.equal(href.includes('theme=abolition'), true);
    assert.equal(href.includes('status=historic'), true);
    assert.equal(href.includes('floor=B'), true);
    assert.equal(href.includes('confidence='), false);
  });

  it('keeps floor through edge allowlist normalization (Records→Atlas handoff bug)', () => {
    const href = buildAtlasHref({
      ...EMPTY_RECORDS_QUERY,
      state: 'OK',
      evidence: 'B',
    });
    assert.equal(href, '/explore?state=OK&floor=B');
    const qs = href.slice('/explore?'.length);
    const params = Object.fromEntries(new URLSearchParams(qs).entries());
    const normalized = normalizeQueryString('/explore', params);
    assert.equal(normalized.includes('floor=B'), true, `stripped floor: ${normalized}`);
    assert.equal(normalized.includes('state=OK'), true);
  });

  it('parses floor into ExploreViewState and back into DiscoveryState', () => {
    const view = parseExploreSearchParams({ state: 'OK', floor: 'A', kind: 'people' });
    assert.equal(view.floor, 'A');
    const discovery = discoveryFromExplore(view);
    assert.equal(discovery.evidence, 'A');
    assert.deepEqual(discovery.state, ['OK']);
    assert.deepEqual(discovery.kind, ['people']);
    assert.equal(discovery.view, 'map');
  });

  it('list href drops map-only fields and keeps shared narrowing', () => {
    const discovery = discoveryFromExplore(
      parseExploreSearchParams({
        kind: 'place',
        theme: 'redlining',
        floor: 'C',
        state: 'NY',
        sat: '1',
        group: '1',
      }),
    );
    const href = listHrefFromDiscovery(discovery);
    assert.equal(href.includes('kind=place'), true);
    assert.equal(href.includes('topic=redlining'), true);
    assert.equal(href.includes('evidence=C'), true);
    assert.equal(href.includes('state=NY'), true);
    assert.equal(href.includes('sat='), false);
    assert.equal(href.includes('group='), false);
  });

  it('does not claim text query crosses to the map', () => {
    const discovery = discoveryFromRecords({ ...EMPTY_RECORDS_QUERY, q: 'greenwood', state: 'OK' });
    const mapHref = mapHrefFromDiscovery(discovery);
    assert.equal(mapHref.includes('q='), false);
    assert.equal(mapHref.includes('state=OK'), true);
    const listHref = listHrefFromDiscovery(discovery);
    assert.equal(listHref.includes('q=greenwood'), true);
  });

  it('buildAtlasHref and mapHrefFromDiscovery agree on shared narrowing', () => {
    const records = {
      ...EMPTY_RECORDS_QUERY,
      kind: 'place',
      state: 'OK',
      evidence: 'B',
      topic: 'abolition',
    };
    const fromRecords = new URLSearchParams(buildAtlasHref(records).replace(/^\/explore\?/, ''));
    const fromDiscovery = new URLSearchParams(
      mapHrefFromDiscovery(discoveryFromRecords(records)).replace(/^\/explore\?/, ''),
    );
    assert.deepEqual(Object.fromEntries(fromRecords), Object.fromEntries(fromDiscovery));
  });

  it('recovers DiscoveryState from Place arrival params and preserves return narrowing', () => {
    const arrival = discoveryFromSearchParams({
      from: 'records',
      kind: 'place',
      state: 'OK',
      floor: 'B',
      theme: 'abolition',
    });
    assert.equal(arrival.view, 'list');
    assert.deepEqual(arrival.kind, ['place']);
    assert.deepEqual(arrival.state, ['OK']);
    assert.equal(arrival.evidence, 'B');
    assert.deepEqual(arrival.topic, ['abolition']);

    const ret = placeDiscoveryReturn('ent_dunbar_school_001', arrival, {
      lat: 38.9,
      lng: -77.0,
    });
    assert.equal(ret.mapHref.includes('selected=ent_dunbar_school_001'), true);
    assert.equal(ret.mapHref.includes('floor=B'), true);
    assert.equal(ret.mapHref.includes('state=OK'), true);
    assert.equal(ret.listHref.includes('kind=place'), true);
    assert.equal(ret.listHref.includes('evidence=B'), true);
    assert.match(ret.mapLabel, /narrowing/i);
    assert.match(ret.listLabel, /narrowing/i);
  });

  it('placeArrivalQuery marks map handoff and survives Place allowlist', () => {
    const qs = placeArrivalQuery(
      {
        kind: ['place'],
        state: ['DC'],
        evidence: 'B',
        view: 'map',
      },
      'map',
    );
    assert.equal(qs.includes('from=map'), true);
    assert.equal(qs.includes('state=DC'), true);
    assert.equal(qs.includes('evidence=B'), true);
    const normalized = normalizeQueryString(
      '/place/dunbar',
      Object.fromEntries(new URLSearchParams(qs)),
    );
    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(normalized)),
      Object.fromEntries(new URLSearchParams(qs)),
    );
  });

  it('placeDiscoveryReturn carries list prev/next when neighbors are supplied', () => {
    const ret = placeDiscoveryReturn('ent_a', { view: 'list', state: ['DC'] }, undefined, {
      previous: { href: '/place/alpha?from=list&state=DC', name: 'Alpha' },
      next: { href: '/place/gamma?from=list&state=DC', name: 'Gamma' },
      index: 1,
      total: 3,
    });
    assert.equal(ret.previousHref?.includes('alpha'), true);
    assert.equal(ret.nextHref?.includes('gamma'), true);
    assert.equal(ret.positionLabel, '2 of 3 in this list');
  });
});
