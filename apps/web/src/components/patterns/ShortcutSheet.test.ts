/**
 * Shortcut sheet: it renders the registry rather than a hand-kept list, in four columns.
 *
 * The strong assertion here is completeness — every command the palette can run appears in the
 * sheet. A sheet that silently omits a shortcut is worse than no sheet, because the reader stops
 * looking for the ones it does not list.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { ShortcutSheet } from './ShortcutSheet';
import { COMMAND_SECTIONS, COMMANDS } from './command-palette/command-registry';
import { GLOBAL_BINDINGS } from '../../lib/keyboard/bindings';

function render(open = true): string {
  return renderToStaticMarkup(createElement(ShortcutSheet, { open, onClose: () => {} }));
}

test('a closed sheet renders nothing', () => {
  assert.equal(render(false), '');
});

test('every registry command appears with its chord', () => {
  const html = render();
  for (const command of COMMANDS) {
    assert.match(html, new RegExp(command.title), `sheet is missing "${command.title}"`);
    for (const cap of command.keys) {
      const escaped = cap.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
      assert.match(html, new RegExp(escaped), `sheet is missing key cap ${cap}`);
    }
  }
});

test('the globals the registry does not own are listed too', () => {
  const html = render();
  for (const binding of GLOBAL_BINDINGS) {
    assert.match(html, new RegExp(binding.title), `sheet is missing "${binding.title}"`);
  }
});

test('the four columns are the documented ones, in order', () => {
  const html = render();
  const positions = COMMAND_SECTIONS.map((section) =>
    html.indexOf(`ds-shortcuts__section">${section}<`),
  );
  assert.equal(
    positions.every((position) => position >= 0),
    true,
    'a documented column is missing',
  );
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
    'columns are out of order',
  );
});

test('the sheet is a modal dialog with an accessible name', () => {
  const html = render();
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="ds-shortcuts-title"/);
});

test('the scrim is reachable by keyboard rather than a click-only div', () => {
  const html = render();
  assert.match(html, /class="ds-shortcuts__scrim"[^>]*aria-label="Close keyboard shortcuts"/);
});

test('the single-key setting is stated in the sheet the ? key opens', () => {
  const html = render();
  // The criterion is that a reader who finds the keyboard sheet finds the switch. A setting that
  // exists only in storage, or only in a preferences screen elsewhere, does not satisfy it.
  assert.match(html, /Single-key shortcuts/);
  assert.match(html, /type="checkbox"/);
  // And that it says what turning it off costs, so the reader is not left to discover by testing
  // that ⌘ and ⌥ still work.
  assert.match(html, /Off leaves ⌘ and ⌥ chords working/);
});

test('the setting renders on by default, without reading storage on the server', () => {
  // `getServerSingleKeyEnabled` is the server snapshot. If the checked state came from a storage
  // read instead, this render would throw rather than merely disagree.
  assert.match(render(), /type="checkbox"[^>]*checked/);
});
