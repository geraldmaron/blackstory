/**
 * Camera console: six moves, keys that match the registry, and a dignity gate that is visible in
 * the markup rather than trusted to review.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { CameraConsole, cameraConsoleClearance, type CameraConsoleProps } from './CameraConsole';
import { COMMANDS, KEYED_CAMERA_MOVES } from '../patterns/command-palette/command-registry';

function consoleProps(overrides: Partial<CameraConsoleProps> = {}): CameraConsoleProps {
  return {
    onMove: () => {},
    onZoom: () => {},
    bearing: 0,
    onResetBearing: () => {},
    ...overrides,
  };
}

test('all six keyed moves render', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  for (const label of ['Wide', 'Push in', 'Orbit', 'Tilt', 'Spotlight', 'Trace']) {
    assert.match(html, new RegExp(label), `missing move: ${label}`);
  }
  assert.equal(KEYED_CAMERA_MOVES.length, 6);
});

test('each move shows the key cap the registry defines, not a hand-typed one', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  for (const move of KEYED_CAMERA_MOVES) {
    const command = COMMANDS.find((entry) => entry.id === `camera.${move}`);
    assert.ok(command, `registry is missing camera.${move}`);
    assert.match(
      html,
      new RegExp(`<kbd[^>]*>${command.keys.join('')}</kbd>`),
      `console key cap drifted from the registry for ${move}`,
    );
  }
});

test('zoom lives in the console, so the map keeps one control vocabulary', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  assert.match(html, /aria-label="Zoom in"/);
  assert.match(html, /aria-label="Zoom out"/);
});

test('the header exposes reset, compass, and zoom — not only the six-move grid', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps({ bearing: 0 })));
  assert.match(
    html,
    /class="ds-camera__head"[^]*ds-camera__reset[^]*ds-camera__compass[^]*ds-camera__grid/,
  );
  assert.match(html, /aria-label="Reset map view"/);
});

test('the compass reports the live bearing and never disables, regardless of the active record', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({
        bearing: 47,
        activeRecord: { kind: 'event', mapTone: 'massacre', displayName: 'Lynching of a man' },
      }),
    ),
  );
  assert.match(html, /aria-label="Reset map to north \(currently facing NE, 47 degrees\)"/);
  assert.match(html, /ds-camera__compass--off-north/);
  assert.doesNotMatch(html, /class="ds-camera__compass[^"]*" disabled/);
});

test('the compass stays quiet when the plate is already north', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps({ bearing: 0 })));
  assert.doesNotMatch(html, /ds-camera__compass--off-north/);
});

test('the compass needle rotates opposite bearing so it always points true north', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps({ bearing: 90 })));
  assert.match(html, /rotate\(-90deg\)/);
});

test('with no record selected every move is available', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  assert.equal(html.includes('disabled'), false);
});

test('a lynching record refuses push, orbit, spotlight and trace', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({
        activeRecord: { kind: 'event', mapTone: 'massacre', displayName: 'Lynching of a man' },
      }),
    ),
  );
  // Wide and tilt survive; the other four are refused.
  assert.equal(html.match(/disabled=""/g)?.length, 4);
  assert.match(html, /does not use camera drama on records of harm/);
});

test('spotlight is refused for a person record regardless of tone', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({ activeRecord: { kind: 'person', displayName: 'A person' } }),
    ),
  );
  assert.equal(html.match(/disabled=""/g)?.length, 1);
});

test('the refusal reason is plain language with no bead id or doc reference', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({ activeRecord: { kind: 'person', displayName: 'A person' } }),
    ),
  );
  assert.equal(/repo-[a-z0-9]{4}/.test(html), false);
  assert.equal(html.includes('design-direction'), false);
  assert.equal(html.includes('§'), false);
  assert.equal(html.includes('—'), false);
});

test('a refusal is a visible line in the console, not only a hover title', () => {
  const withRefusal = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({ activeRecord: { kind: 'person', displayName: 'A person' } }),
    ),
  );
  assert.match(withRefusal, /class="ds-camera__refusal"/);

  const withoutRefusal = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  assert.doesNotMatch(withoutRefusal, /ds-camera__refusal/);
});

test('spotlight reports whether it is currently up', () => {
  const on = renderToStaticMarkup(createElement(CameraConsole, consoleProps({ spotlit: true })));
  assert.match(on, /aria-pressed="true"/);
  const off = renderToStaticMarkup(createElement(CameraConsole, consoleProps()));
  assert.match(off, /aria-pressed="false"/);
});

/**
 * The results rail's floor is derived from this console's measured footprint, not from a number
 * kept by hand. The hand-kept number is exactly what broke: it stayed at a 174px console after the
 * WCAG 2.5.5 bump grew the panel to 218px, and the rail's bottom rows rendered under the console.
 */
test('the rail floor clears the console it sits above, at either height the console takes', () => {
  // Measured at 1440x900: a 218px console at a 16px offset, and 286px once the refusal note is
  // on. Both are footprints the rail has to clear, which is why the value is measured, not typed.
  assert.equal(cameraConsoleClearance(218 + 16), '246px');
  assert.equal(cameraConsoleClearance(286 + 16), '314px');
});

test('the clearance always exceeds the footprint, never merely equals it', () => {
  for (const footprint of [120, 234, 302, 400]) {
    const clearance = Number.parseInt(cameraConsoleClearance(footprint), 10);
    assert.ok(clearance > footprint, `clearance ${clearance} does not clear ${footprint}px`);
  }
});

test('a violence-constrained lens refuses spotlight and trace with nothing selected', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({ lens: { topicId: 'lynching', topicLabel: 'Lynching' } }),
    ),
  );
  // Wide, push, orbit, tilt and flyToRecord survive; spotlight and trace are refused.
  assert.equal(html.match(/disabled=""/g)?.length, 2);
  assert.match(html, /does not use camera drama on records of harm/);
});

test('a lens topic unrelated to violence refuses nothing with no record selected', () => {
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({ lens: { topicId: 'civil-rights', topicLabel: 'Civil rights movement' } }),
    ),
  );
  assert.equal(html.includes('disabled'), false);
});

test('a violence-constrained lens still refuses the record-level moves it already refused', () => {
  // Belt and suspenders: a violence-adjacent SELECTED record inside a violence-constrained lens
  // does not somehow refuse fewer moves than the record-only case already did.
  const html = renderToStaticMarkup(
    createElement(
      CameraConsole,
      consoleProps({
        activeRecord: { kind: 'event', mapTone: 'massacre', displayName: 'Lynching of a man' },
        lens: { topicId: 'lynching', topicLabel: 'Lynching' },
      }),
    ),
  );
  assert.equal(html.match(/disabled=""/g)?.length, 4);
});
