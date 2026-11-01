/**
 * StoryRecords: typed relations from storyCitedEntities, and honest complete / partial /
 * unavailable / empty states. Unresolved ids are counted, never named or invented.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CitesRelation } from '../../lib/release/build-cites-edge';
import { StoryRecords, storyRecordsState } from './story-records';

void React;

const linked = new Map<string, CitesRelation>([
  ['ent-school', 'referenced in'],
  ['ent-map', 'mapped in'],
  ['ent-lost', 'referenced in'],
]);

const school = { id: 'ent-school', displayName: 'Dunbar High School' };
const place = { id: 'ent-map', displayName: 'Greenwood District' };

function render(props: Partial<React.ComponentProps<typeof StoryRecords>> = {}): string {
  return renderToStaticMarkup(
    <StoryRecords
      noun="chapter"
      linked={linked}
      records={[school, place]}
      source="live"
      {...props}
    />,
  );
}

describe('storyRecordsState', () => {
  it('classifies by linked and resolved counts and the read source', () => {
    assert.equal(storyRecordsState(0, 0, 'none'), 'empty');
    assert.equal(storyRecordsState(2, 2, 'live'), 'complete');
    assert.equal(storyRecordsState(3, 2, 'live'), 'partial');
    assert.equal(storyRecordsState(3, 0, 'live'), 'unavailable');
    assert.equal(storyRecordsState(3, 3, 'none'), 'unavailable');
  });
});

describe('StoryRecords', () => {
  it('states each relation in reader words and keeps the entity href contract', () => {
    const markup = render({
      linked: new Map(linked),
      records: [school, place, { id: 'ent-lost', displayName: 'Old Mill' }],
    });
    assert.match(markup, /data-state="complete"/);
    assert.ok(markup.includes('href="/entity/ent-school"'));
    assert.ok(markup.includes('href="/entity/ent-map"'));
    assert.match(markup, /referenced in this chapter/);
    assert.match(markup, /mapped in this chapter/);
  });

  it('keeps the derivation order, not the read order', () => {
    const markup = render({ records: [place, school] });
    assert.ok(markup.indexOf('Dunbar High School') < markup.indexOf('Greenwood District'));
  });

  it('partial: lists what resolved, counts what did not, and invents nothing', () => {
    const markup = render();
    assert.match(markup, /data-state="partial"/);
    assert.match(markup, /1 more linked record could not be loaded right\s+in this public release/);
    assert.ok(!markup.includes('ent-lost'));
    assert.ok(!markup.includes('/entity/ent-lost'));
  });

  it('unavailable: says so instead of an empty state, with no names or ids', () => {
    const markup = render({ records: [], source: 'live' });
    assert.match(markup, /data-state="unavailable"/);
    assert.match(markup, /3 linked records could not be loaded right\s+in this public release/);
    assert.ok(!markup.includes('<ul'));
    assert.ok(!markup.includes('ent-'));
    assert.ok(!/No archive records are linked/.test(markup));
  });

  it('distinguishes retrieval failure from unresolved public links', () => {
    const markup = render({ records: [], source: 'failed' });
    assert.match(markup, /could not be retrieved/);
    assert.match(markup, /Reload to try again/);
    assert.ok(!markup.includes('in this public release'));
  });

  it('empty: a statement about links, not about source material', () => {
    const markup = render({ linked: new Map(), records: [], source: 'none' });
    assert.match(markup, /data-state="empty"/);
    assert.match(markup, /No archive records are linked to this chapter yet/);
    assert.match(markup, /says nothing about the sources/);
    assert.ok(!markup.includes('<ul'));
  });

  it('never claims to be every record the chapter draws on', () => {
    for (const markup of [render(), render({ records: [] })]) {
      assert.ok(!/Every record/.test(markup));
      assert.ok(!/records behind/i.test(markup));
      assert.match(markup, /Other sources informed|References/);
    }
  });

  it('uses the entry noun on short pieces', () => {
    assert.match(render({ noun: 'entry' }), /Records linked to this entry/);
  });
});

describe('page wiring', () => {
  const page = readFileSync(new URL('../../app/stories/[slug]/page.tsx', import.meta.url), 'utf8');

  it('derives links only from storyCitedEntities and captures the read source', () => {
    assert.match(page, /storyCitedEntities\(doc\)/);
    assert.match(page, /source=\{citedRead\.source\}/);
    assert.match(page, /await listPublicEntityViewsByIds\(\[\.\.\.linkedRecords\.keys\(\)\]\)/);
  });

  it('leaves numbered reference anchors to StoryReferences', () => {
    assert.match(
      page,
      /<StoryReferences references=\{story\.references\} headingId="about-this-chapter" \/>/,
    );
    const refs = readFileSync(new URL('./StoryReferences.tsx', import.meta.url), 'utf8');
    assert.match(refs, /id=\{`ref-\$\{ref\.number\}`\}/);
  });
});
