/**
 * The record page rendered from seed records: what it may state is bounded by the record's data.
 *
 * Two honesty fixes are pinned here. A place page once printed "Also documented" over a
 * hardcoded list of unrelated stands; an invention page once said "Still standing or operating
 * today" and offered directions to an 18th-century clock. Neither may come back.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getPublicEntity,
  listPublicEntities,
  type PublicEntityView,
} from '../../../data/public-seed';
import { placeDiscoveryReturn } from '../../../lib/discovery/discovery-state';
import { precisionInWords } from '../../../lib/map-experience/geo-precision';
import { EvidenceList } from '../../../components/evidence/EvidenceList';
import { EntityRecordView, mapPrecisionFor, typedConnections } from './EntityRecordPage';

void React;

function seed(id: string): PublicEntityView {
  const entity = getPublicEntity(id);
  assert.ok(entity, `seed record ${id} exists`);
  return entity;
}

const POINT = { lat: 38.9126, lng: -77.0217 };

function render(
  entity: PublicEntityView,
  extra: Partial<Parameters<typeof EntityRecordView>[0]> = {},
) {
  return renderToStaticMarkup(<EntityRecordView entity={entity} {...extra} />);
}

test('a place shows only its own typed connections, never a list of other stands', () => {
  const church = seed('ent_15th_st_church_001');
  const lonely: PublicEntityView = { ...church, relatedNeighbors: [], continueLearning: [] };
  const html = render(lonely, { point: POINT });
  assert.doesNotMatch(html, /Also documented/);
  assert.doesNotMatch(html, /Connected records/);
  for (const other of listPublicEntities()) {
    if (other.id === church.id) continue;
    assert.ok(
      !html.includes(`>${other.displayName}<`),
      `${other.displayName} must not appear on a page with no typed relationship to it`,
    );
  }
});

test('every connection row is one of the record’s own relationships, stated in words', () => {
  const school = seed('ent_dunbar_school_001');
  const rows = typedConnections(school);
  const neighborNames = new Set((school.relatedNeighbors ?? []).map((n) => n.displayName));
  for (const row of rows) {
    assert.ok(neighborNames.has(row.name), `${row.name} is a stored neighbor`);
    assert.ok(row.relation.length > 0);
    assert.doesNotMatch(row.relation, /from their record|related/);
  }
  // Two-hop leads are not this record's relationships.
  const leads = (school.continueLearning ?? []).filter(
    (lead) => !neighborNames.has(lead.displayName),
  );
  for (const lead of leads) {
    assert.ok(!rows.some((row) => row.name === lead.displayName));
  }
});

test('an invention never claims to stand today and never offers directions', () => {
  const clock: PublicEntityView = {
    ...seed('ent_15th_st_church_001'),
    // The seed type knows four kinds; released records carry more, invention among them.
    kind: 'invention' as unknown as PublicEntityView['kind'],
    status: 'active',
    locationPrecision: 'site',
  };
  const html = render(clock, { point: POINT });
  assert.doesNotMatch(html, /Still standing|operating today/i);
  assert.doesNotMatch(html, /Open in maps|Directions/);
  // Compared as parsed hosts: a substring test on a URL is what CodeQL flags, rightly.
  const linkedHosts = [...html.matchAll(/href="(https?:[^"]+)"/g)].map(
    ([, href]) => new URL(href!).hostname,
  );
  assert.ok(
    !linkedHosts.some((host) => /^(maps\.apple\.com|(www\.|maps\.)?google\.com)$/.test(host)),
  );
  // Its status token is not read back as a fact about the physical world.
  assert.doesNotMatch(html, />Active</);
});

test('Open in maps appears only for a visitable site at site precision', () => {
  const church = seed('ent_15th_st_church_001');
  const atSite = render({ ...church, locationPrecision: 'site' }, { point: POINT });
  assert.match(atSite, /Open in maps/);
  const atCity = render({ ...church, locationPrecision: 'city' }, { point: POINT });
  assert.doesNotMatch(atCity, /Open in maps/);
  const unpinned = render({ ...church, locationPrecision: 'site' });
  assert.doesNotMatch(unpinned, /Open in maps/);
});

test('the citation line states where, when and evidence once, with precision in words', () => {
  const school = seed('ent_dunbar_school_001');
  const html = render(school, { point: POINT });
  for (const label of ['Where', 'When', 'Evidence']) {
    assert.equal(html.split(`<dt class="ds-recpage__fact-label">${label}</dt>`).length, 2);
  }
  // The one wording set every surface prints (geo-precision.ts).
  assert.ok(html.includes(precisionInWords(school.locationPrecision)));
  const atCampus = render({ ...school, locationPrecision: 'campus' }, { point: POINT });
  assert.match(atCampus, /Campus-level location, not an exact address/);
});

test('no release id, pipeline token or placeholder plate reaches the page', () => {
  const school = seed('ent_dunbar_school_001');
  const html = render(school, { point: POINT });
  assert.ok(!html.includes(school.revision.releaseId));
  assert.doesNotMatch(html, /Partial Enrichment|Research coverage|How far researched/);
  assert.doesNotMatch(html, /ds-entity-mark|data-media="mark"/);
});

test('a long lede is clamped for the eye but kept whole in the HTML', () => {
  const school = seed('ent_dunbar_school_001');
  const summary = Array.from({ length: 90 }, (_, index) => `word${index}`).join(' ');
  const html = render({ ...school, summary });
  assert.match(html, /data-clamp=""/);
  assert.match(html, /Read full summary/);
  assert.ok(html.includes('word89'));
});

test('the pager appears only when the reader arrived from a list', () => {
  const school = seed('ent_dunbar_school_001');
  const neighbors = {
    previous: { href: '/place/a?from=list', name: 'Record A' },
    next: { href: '/place/b?from=list', name: 'Record B' },
    index: 2,
    total: 12,
  };
  const fromList = render(school, {
    point: POINT,
    arrival: { view: 'list' },
    returns: placeDiscoveryReturn(school.id, { view: 'list' }, neighbors),
  });
  assert.match(fromList, /rel="prev"[^>]*>[^]*Record A/);
  assert.match(fromList, /Back to the list/);

  const direct = render(school, {
    point: POINT,
    returns: placeDiscoveryReturn(school.id, {}),
  });
  assert.doesNotMatch(direct, /rel="prev"|rel="next"|Back to the list/);
  assert.match(direct, />Records<\/a>/);
});

test('a record whose accepted prose documents harm carries the content note in its raw HTML', () => {
  const {
    sensitivity: _sensitivity,
    sensitivityClass: _class,
    ...church
  } = seed('ent_15th_st_church_001');
  const harm: PublicEntityView = {
    ...church,
    historicalContext:
      'Maroon communities sheltered people who escaped enslavement for generations.',
  };
  const html = render(harm, { point: POINT });
  assert.match(html, /class="ds-recpage__note"/);
  assert.match(html, /<strong>Sensitive content\.<\/strong>/);
  // The full disclaimer is in the HTML, behind a disclosure, not a warning box.
  assert.match(html, /presented for its historical and educational value/);
  assert.doesNotMatch(html, /ds-notice--warning/);

  const calm: PublicEntityView = {
    ...church,
    relevanceExplanation: 'A congregation that founded a school.',
    historicalContext: 'The congregation founded a school and a choir.',
    claims: [],
  };
  assert.doesNotMatch(render(calm, { point: POINT }), /ds-recpage__note|Sensitive content/);
});

test('registry topics become pills linking to the records list; a quiet record shows none', () => {
  const church = seed('ent_15th_st_church_001');
  const html = render({ ...church, topicIds: ['banking', 'not-a-topic'] });
  assert.match(html, /href="\/records\?topic=banking"[^>]*>Banking</);
  assert.doesNotMatch(html, /not-a-topic/);
  const quiet = render({
    ...church,
    topicIds: ['banking'],
    sensitivity: { kind: 'violence' } as never,
  });
  assert.doesNotMatch(quiet, /aria-label="Topics"/);
});

/* Phase 3b (docs/ui/DESIGN.md sections 7.3 and 9.1). */

test('a law is drawn at its jurisdiction, never as an exact site', () => {
  const law = (jurisdictionLabel: string, locationPrecision: string) =>
    mapPrecisionFor({
      kind: 'law',
      jurisdictionLabel,
      locationPrecision,
    } as unknown as PublicEntityView);
  // A state's law stored at its capitol building is the state.
  assert.equal(law('Jackson, Mississippi', 'institution'), 'state');
  assert.equal(law('Oregon', 'institution'), 'state');
  // A federal law stored at the Capitol is no sharper than Washington.
  assert.equal(law('Washington, District of Columbia', 'institution'), 'city');
  assert.equal(law('Washington, District of Columbia', 'city'), 'city');
  // Every other kind keeps its stored precision.
  const church = seed('ent_15th_st_church_001');
  assert.equal(mapPrecisionFor(church), church.locationPrecision);
});

test('each claim is a numbered statement with its own receipt at a persistent address', () => {
  const church = seed('ent_15th_st_church_001');
  const html = render(church, { point: POINT });
  const shown = church.claims.filter((claim) => html.includes(`id="${claim.id}"`));
  assert.ok(shown.length > 0, 'claims are addressed by their stored ids');
  assert.doesNotMatch(html, /id="source-\d+"/);
  assert.equal(html.match(/class="ds-receipt ds-evidence__receipt"/g)?.length, shown.length);
  // The grade is a glyph and words, never a letter.
  assert.match(
    html,
    /ds-receipt__grade"><a href="\/methodology#evidence-grades"[^>]*><span class="ds-grade-tag/,
  );
  // The map is an exhibit on ink with its own address; without a photograph it leads.
  assert.match(html, new RegExp(`<figure id="${church.id}-(photograph|map)"`));
  assert.match(html, /data-kind="map"[^>]*>.*?data-ground="ink" data-ground-fixed=""/s);
});

test('the page offers one Cite control for its canonical URL and none on a claim', () => {
  const church = seed('ent_15th_st_church_001');
  const html = render(church, { point: POINT, canonicalPath: '/place/fifteenth-street-church' });
  assert.equal(html.match(/<details class="ds-cite/g)?.length, 1);
  assert.match(html, /\/place\/fifteenth-street-church/);
  for (const style of ['MLA', 'APA', 'Chicago']) assert.ok(html.includes(`Copy ${style}`));
});

test('a quiet record gets quiet exhibits and a still map', () => {
  const church = seed('ent_15th_st_church_001');
  const html = render(
    { ...church, sensitivity: { level: 'sensitive' } as never, primaryImage: undefined } as never,
    { point: POINT },
  );
  assert.match(html, /class="ds-exhibit ds-exhibit--quiet" data-kind="map"/);
  assert.match(html, /data-still=""/);
  assert.doesNotMatch(html, /Use two fingers/);
});

test('a disputed value prints both values, each with the source it came from', () => {
  const html = renderToStaticMarkup(
    <EvidenceList
      items={[
        {
          id: 'claim_x_01',
          statement: 'Founded: 1841',
          source: { title: 'Church history', href: 'https://example.org/a' },
          level: 'medium',
          dispute: {
            hasDispute: true,
            primaryValue: '1841',
            alternates: [
              {
                value: '1843',
                credible: true,
                kind: 'contradicting',
                source: 'County deed book',
                sourceHref: 'https://example.org/b',
              },
              { value: '1850', credible: false, kind: 'alternative' },
            ],
          },
        },
      ]}
    />,
  );
  assert.match(
    html,
    /1841<\/span><div class="ds-receipt[^"]*"><span class="ds-receipt__source"><a href="https:\/\/example.org\/a"/,
  );
  assert.match(
    html,
    /1843<\/span><div class="ds-receipt[^"]*"><span class="ds-receipt__source"><a href="https:\/\/example.org\/b"[^>]*>County deed book/,
  );
  // A value with no source on file says so; it never borrows the first value's receipt.
  assert.match(
    html,
    /1850 \(not independently credible\)<\/span><div class="ds-receipt[^"]*"><span class="ds-receipt__source">Source not on file/,
  );
});

test('a record titled a massacre is quiet even when its topics do not say so', () => {
  const church = seed('ent_15th_st_church_001');
  const titled = {
    ...church,
    displayName: 'Wilmington massacre and coup of 1898',
    topicIds: ['great-migration'],
    topicTags: ['great-migration'],
  } as PublicEntityView;
  assert.match(render(titled, { point: POINT }), /<main[^>]*data-quiet=""/);
});
