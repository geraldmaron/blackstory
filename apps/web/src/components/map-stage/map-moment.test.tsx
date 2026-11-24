/** The map moment's camera, visibility and arbitration contract. Moved out of the page kit's tests. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  MapMoment,
  momentIsVisible,
  pickLiveMoment,
  resolveMomentCamera,
  resolveMomentVisibility,
} from './MapMoment';

void React;

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('map moment', () => {
  it('renders the slot, the tag and the caption, and starts idle', () => {
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90.049, 35.1495], zoom: 12 }} note="Memphis, 1866." />,
    );
    assert.match(html, /class="ds-mapmoment"/);
    assert.match(html, /data-live="0"/);
    assert.match(html, /ds-mapmoment__plate/);
    assert.match(html, /<figcaption[^>]*>Memphis, 1866\.<\/figcaption>/);
  });

  it('says the map is unavailable when no stage is mounted, rather than inviting a scroll', () => {
    // The §10 degrade. A slot with no plate behind it must not tell the reader to scroll for a
    // map that will never arrive; the caption is what carries the point.
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-87.63, 41.9] }} note="Chicago." />,
    );
    assert.match(html, /The map is unavailable\. The caption below carries the point\./);
    assert.doesNotMatch(html, /Scroll to bring the map here/);
  });

  it('a plain moment is tagged STILL, not LIVE', () => {
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-92.1, 46.78] }} note="Duluth, 1920." plain />,
    );
    assert.match(html, /data-plain="1"/);
    assert.match(html, /Plate · Still/);
    assert.doesNotMatch(html, /Plate · Live/);
  });

  it('derives STILL from a violence-adjacent subject with no plain prop at all (SP-26)', () => {
    // The gap this closes: an author who forgets to set `plain` on a moment about violence used
    // to get LIVE by default. Passing the subject instead means there is nothing to forget.
    const html = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-92.1, 46.78] }}
        note="Duluth, 1920."
        subject={{ topicTags: ['Lynching'] }}
      />,
    );
    assert.match(html, /data-plain="1"/);
    assert.match(html, /Plate · Still/);
  });

  it('a non-violent subject stays LIVE, and an explicit plain still overrides a subject either way', () => {
    const ordinary = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-87.6, 41.9] }}
        note="A neighborhood."
        subject={{ topicTags: ['neighborhood'] }}
      />,
    );
    assert.match(ordinary, /Plate · Live/);

    const forcedStill = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-87.6, 41.9] }}
        note="A neighborhood, held still for a documented reason."
        subject={{ topicTags: ['neighborhood'] }}
        plain
      />,
    );
    assert.match(forcedStill, /Plate · Still/);

    const forcedLive = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-92.1, 46.78] }}
        note="Overridden live for a documented reason."
        subject={{ topicTags: ['Lynching'] }}
        plain={false}
      />,
    );
    assert.match(forcedLive, /Plate · Live/);
  });

  it('the Explore hand-off renders only when a destination is given', () => {
    const without = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." />,
    );
    assert.doesNotMatch(without, /ds-mapmoment__open/);

    const with_ = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." atlasHref="/explore?find=place" />,
    );
    assert.match(with_, /href="\/explore\?find=place"/);
  });

  it('refuses pitch and bearing on a plain moment, and cuts instead of flying', () => {
    // The dignity rule lives at the camera layer, not at the call site: passing a pitch to a
    // plain moment must not tilt it.
    const resolved = resolveMomentCamera(
      { center: [-92.1, 46.78], zoom: 12, pitch: 45, bearing: 30 },
      { plain: true },
    );
    assert.equal(resolved.pitch, 0);
    assert.equal(resolved.bearing, 0);
    assert.equal(resolved.move, 'cut');
  });

  it('reduced motion cuts too, without being told the subject', () => {
    const resolved = resolveMomentCamera(
      { center: [-87.63, 41.9], zoom: 13, pitch: 40, bearing: -12 },
      { reducedMotion: true },
    );
    assert.equal(resolved.move, 'cut');
    assert.equal(resolved.pitch, 0);
  });

  it('an ordinary moment keeps its composition', () => {
    const resolved = resolveMomentCamera(
      { center: [-87.63, 41.9], zoom: 13, pitch: 40, bearing: -12 },
      {},
    );
    assert.equal(resolved.move, 'fly');
    assert.equal(resolved.pitch, 40);
    assert.equal(resolved.bearing, -12);
  });
});

describe('map moment visibility', () => {
  // When the map is unavailable, a map moment must retain its still image even if its id is
  // selected. These tests exercise that state boundary without simulating WebGL itself.
  it('a stage being mounted is not the same as the plate being able to paint', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: false,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, true);
  });

  it('claims live only once the stage says the map can actually paint', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: true,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, true);
    assert.equal(resolved.unavailable, false);
  });

  it('being the live candidate does not matter once the map cannot paint', () => {
    // The exact case that reads wrong without the fix: this moment IS the one holding the slot,
    // but the plate behind it has nothing to show.
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: false,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, false);
  });

  it('no stage mounted is unavailable the same way a failed plate is', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: false,
      mapCanPaint: false,
      isLiveCandidate: false,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, true);
  });

  it('an idle moment on a healthy plate is neither live nor unavailable', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: true,
      isLiveCandidate: false,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, false);
  });
});

describe('map moment arbitration', () => {
  const slot = (id: string, top: number, height = 300) => ({
    id,
    top,
    bottom: top + height,
    height,
  });

  it('a room with four moments frames exactly one', () => {
    // Chapter detail is the case: four moments, one plate.
    const live = pickLiveMoment(
      [slot('a', -400), slot('b', 100), slot('c', 700), slot('d', 1200)],
      800,
    );
    assert.equal(live, 'b');
  });

  it('no moment takes the plate until it is properly on screen', () => {
    // Just peeking over the fold is not enough; below the floor the plate stays parked.
    assert.equal(pickLiveMoment([slot('a', 700)], 800), null);
    assert.equal(pickLiveMoment([slot('a', 500)], 800), 'a');
  });

  it('a zero-height slot never wins', () => {
    // A moment inside a collapsed disclosure has a rect, and it is all zeroes.
    assert.equal(pickLiveMoment([{ id: 'hidden', top: 0, bottom: 0, height: 0 }], 800), null);
  });

  it('scrolling hands the plate forward one moment at a time', () => {
    const two = [slot('first', 0), slot('second', 320)];
    assert.equal(pickLiveMoment(two, 800), 'first');
    const scrolled = [slot('first', -260), slot('second', 60)];
    assert.equal(pickLiveMoment(scrolled, 800), 'second');
  });

  it('nothing is framed when every moment has scrolled away', () => {
    assert.equal(pickLiveMoment([slot('a', -900), slot('b', 1400)], 800), null);
  });
});

describe('a slot that is laid out but not visible is not a candidate', () => {
  it('refuses a slot the browser reports as not visible, so the plate is released', () => {
    // A moment inside a closed <details>: Chrome collapses the drawer but keeps the contents
    // laid out, so the slot still reports a full-size rect at its old position. Judging by
    // rect alone handed that slot the plate, and the map painted over the prose that had
    // taken the space — the "map bleeding through the text" report.
    const hidden = { checkVisibility: () => false } as unknown as Element;
    const shown = { checkVisibility: () => true } as unknown as Element;
    assert.equal(momentIsVisible(hidden), false);
    assert.equal(momentIsVisible(shown), true);
  });

  it('keeps rect-only behavior where checkVisibility is unsupported, rather than losing every moment', () => {
    assert.equal(momentIsVisible({} as unknown as Element), true);
  });
});

describe('a live moment is a window onto the borrowed plate', () => {
  it('drops the slot background when live, or the plate paints behind an opaque box', () => {
    // The regression this guards was invisible for a long time and hid EVERY map on the site.
    // The plate is fixed at --ds-z-map-plate (0) and the document column sits at
    // --ds-z-content (1), so a plate holding a slot paints behind the column by design. The
    // slot kept its opaque idle ground when live, so the map was positioned perfectly over the
    // slot and then covered by it: every MapMoment rendered an empty box. Nothing failed, no
    // error was logged, and the moment still reported itself live.
    const css = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../page/page-kit.css'),
      'utf8',
    );
    const liveRule = /\.ds-mapmoment\[data-live='1'\]\s+\.ds-mapmoment__plate\s*\{([^}]*)\}/.exec(
      css,
    );
    assert.ok(liveRule, 'the live-slot rule must exist');
    assert.match(
      liveRule[1]!,
      /background:\s*transparent/,
      'a live slot must drop its background so the borrowed plate shows through',
    );
    assert.match(
      liveRule[1]!,
      /pointer-events:\s*none/,
      'a live slot must not intercept hover over the aligned map layer',
    );
  });
});

describe('a live plate never sits behind a prose column', () => {
  /*
   * The map plate stays below opaque document content. Only the bounded live map-moment slot
   * may reveal it; raising the plate or making other prose containers transparent breaks the
   * reading surface.
   */
  const tokens = readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../../packages/ui/src/styles/tokens.css',
    ),
    'utf8',
  );

  it('the plate token sits below the content token, so the plate paints under the page', () => {
    const plate = /--ds-z-map-plate:\s*(-?\d+)/.exec(tokens);
    const content = /--ds-z-content:\s*(-?\d+)/.exec(tokens);
    assert.ok(plate && content, 'both z tokens must be defined');
    assert.ok(
      Number(plate[1]) < Number(content[1]),
      `plate (${plate[1]}) must sit below content (${content[1]})`,
    );
  });

  it('the live map-moment slot is the only box that opens a window onto the plate', () => {
    // Any rule that drops a background to transparent inside the room kit is a candidate
    // window. Exactly one is legitimate: the live moment slot.
    const css = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../page/page-kit.css'),
      'utf8',
    );
    const windows = [...css.matchAll(/([^{}]+)\{([^}]*background:\s*transparent[^}]*)\}/g)].map(
      (match) => match[1]!.trim().split('\n').pop()!.trim(),
    );
    assert.equal(
      windows.length,
      1,
      `expected exactly one plate window, found ${windows.length}: ${windows.join(' | ')}`,
    );
    assert.match(windows[0]!, /\.ds-mapmoment\[data-live='1'\]\s+\.ds-mapmoment__plate/);
  });
});

describe('no room invents its own map moment', () => {
  it('no route defines moment markup outside the kit', () => {
    // Routes use the shared map moment component; CSS may style its descendants.
    const offenders = walk(APP_DIR)
      .filter((file) => /\.(tsx|jsx)$/.test(file))
      .filter((file) => /ds-mapmoment__plate|mm-plate/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));
    assert.deepEqual(offenders, [], 'map moment markup belongs to components/page/MapMoment.tsx');
  });
});
