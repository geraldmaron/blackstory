/**
 * Camera console: six moves, keys that match the registry, and a dignity gate that is visible in
 * the markup rather than trusted to review.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { CameraConsole, type CameraConsoleProps } from './CameraConsole';
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

test('the compass sits in the header, not the six-move grid', () => {
  const html = renderToStaticMarkup(createElement(CameraConsole, consoleProps({ bearing: 0 })));
  assert.match(html, /class="ds-camera__head"[^]*ds-camera__compass[^]*ds-camera__grid/);
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
  assert.doesNotMatch(html, /class="ds-camera__compass" disabled/);
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
