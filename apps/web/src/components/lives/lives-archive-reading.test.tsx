import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LivesAreaBundle } from '@repo/domain/statistics/lives';
import { LIVES_MILESTONES } from '../../lib/lives/lives-milestones';
import { LIVES_ARCHIVE_READINGS } from '../../lib/lives/lives-archive';
import { LivesMilestoneExperience } from './LivesMilestoneExperience';
import { ArchiveFigure } from '../room/Evidence';

test('every life question has inspected visual evidence, a reading, limits and real destinations', () => {
  for (const milestone of LIVES_MILESTONES) {
    const reading = LIVES_ARCHIVE_READINGS[milestone.key];
    assert.ok(reading.date && reading.place && reading.image.alt && reading.image.credit);
    assert.ok(reading.rights && reading.transcription && reading.notice);
    assert.ok(reading.paragraphs.length >= 2);
    assert.ok(reading.connections.length >= 2);
    assert.ok(['tile.loc.gov', 'www.archives.gov'].includes(new URL(reading.image.url).hostname));
    assert.doesNotMatch(JSON.stringify(reading), /—|under construction|coming soon/u);
    const html = renderToStaticMarkup(
      <LivesMilestoneExperience
        milestone={milestone}
        bundle={{ decades: [] } as unknown as LivesAreaBundle}
      />,
    );
    assert.match(html, /ds-archive-figure/);
    assert.match(html, /Read the image in words/);
    assert.match(html, /ds-room-handoff/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /class="lives-era"/);
  }
});

test('documentary figures preserve an accessible description and provenance independently of image loading', () => {
  const reading = LIVES_ARCHIVE_READINGS.school;
  const html = renderToStaticMarkup(
    <ArchiveFigure
      image={reading.image}
      caption={reading.caption}
      rights={reading.rights}
      href={reading.source.url}
    />,
  );
  assert.match(html, /<figure/);
  assert.match(html, /<figcaption/);
  assert.match(html, /Frances Benjamin Johnston/);
  assert.match(html, /referrerPolicy="no-referrer"/);
  assert.match(html, /Inspect the original and source record/);
});

test('a remembered childhood is distinguished from the photograph and later employment policy', () => {
  assert.match(LIVES_ARCHIVE_READINGS.school.companion!.date, /Recalled in 1901/);
  assert.match(LIVES_ARCHIVE_READINGS.school.companion!.scope, /not.*Tuskegee/s);
  assert.match(
    LIVES_ARCHIVE_READINGS.work.companion!.scope,
    /isn’t evidence about defense employment/,
  );
});

test('focus rules use the color token with an explicit width and style', () => {
  for (const path of ['../../app/lives/lives.css', '../room/room-kit.css']) {
    const css = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /outline:\s*var\(--ds-focus-ring\);/);
    assert.match(css, /outline: var\(--ds-focus-width\) solid var\(--ds-focus-ring\)/);
  }
});
