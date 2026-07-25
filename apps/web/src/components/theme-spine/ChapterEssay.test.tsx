/**
 * Integration coverage for ChapterEssay's moment-kind rendering: a 'data' moment renders
 * DataMoment, a 'timeline' moment renders EraTimeline, and a 'map' moment renders
 * MapInsetMoment, all in document order alongside paragraphs and disputes.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChapterEssay } from './ChapterEssay';
import type { ThemeSpineChapter } from '../../lib/theme-impact/source';

void React;

const chapters: readonly ThemeSpineChapter[] = [
  {
    story: {
      id: 'story-1',
      releaseId: 'rel-1',
      slug: 'chapter-one',
      title: 'Chapter One',
      dek: 'The first chapter.',
      publishedAt: '2026-01-01',
      eraLabel: 'HOLC era',
      placeLabel: 'Baltimore, MD',
      relatedEntityIds: ['ent_church'],
      sources: [{ label: 'Test source', url: 'https://example.com' }],
      themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 1 },
      body: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    sections: [
      {
        heading: 'Opening',
        paragraphs: ['Paragraph one.'],
        moments: [
          {
            kind: 'data',
            figure: '42.1%',
            claim: 'Black homeownership rate',
            provenance: { source: 'ACS 5-Year', capture: '2026-07-22', confidence: 'juxtaposition' },
            methodStance: 'juxtaposition',
          },
          {
            kind: 'timeline',
            events: [
              { label: 'FHA underwriting manual', date: '1934' },
              { label: 'HOLC map drawn', date: '1937' },
            ],
            policyEras: [{ id: 'holc_fha', label: 'HOLC / FHA era', span: '1933-1968' }],
          },
          {
            kind: 'map',
            entityId: 'ent_church',
            label: 'Fifteenth Street Presbyterian Church',
            lat: 38.9047,
            lng: -77.0163,
            precision: 'neighborhood',
          },
        ],
        disputes: [
          {
            label: 'Contested count',
            sideA: { sourceLabel: 'County record', claim: 'Twelve families displaced.' },
            sideB: { sourceLabel: 'Oral history', claim: 'Closer to twenty families.' },
          },
        ],
      },
    ],
  },
];

describe('ChapterEssay moment-kind rendering', () => {
  it('renders a data moment as DataMoment', () => {
    const html = renderToStaticMarkup(<ChapterEssay themeTitle="Redlining" chapters={chapters} />);
    assert.match(html, /ds-data-moment/);
    assert.match(html, /42\.1%/);
  });

  it('renders a timeline moment as EraTimeline', () => {
    const html = renderToStaticMarkup(<ChapterEssay themeTitle="Redlining" chapters={chapters} />);
    assert.match(html, /ds-era-timeline/);
    assert.match(html, /aria-label="Timeline: 2 events, 1934 to 1937"/);
  });

  it('renders a map moment as MapInsetMoment', () => {
    const html = renderToStaticMarkup(<ChapterEssay themeTitle="Redlining" chapters={chapters} />);
    assert.match(html, /ds-map-inset-moment/);
    assert.match(html, /Fifteenth Street Presbyterian Church/);
  });

  it('renders moments and disputes in document order after the section paragraphs', () => {
    const html = renderToStaticMarkup(<ChapterEssay themeTitle="Redlining" chapters={chapters} />);
    const paraIdx = html.indexOf('Paragraph one.');
    const dataIdx = html.indexOf('ds-data-moment');
    const timelineIdx = html.indexOf('ds-era-timeline');
    const mapIdx = html.indexOf('ds-map-inset-moment');
    const disputeIdx = html.indexOf('Contested count');
    assert.ok(paraIdx < dataIdx);
    assert.ok(dataIdx < timelineIdx);
    assert.ok(timelineIdx < mapIdx);
    assert.ok(mapIdx < disputeIdx);
  });
});
