/**
 * Confirms History v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HISTORY_DECADE_LIST_CLASS,
  HISTORY_DECADE_STEPPER_CLASS,
  HISTORY_DECADE_TAB_CLASS,
  HISTORY_EDITION_PANEL_CLASS,
  HISTORY_EDITION_ROOT_CLASS,
  historyEditionPanelClassName,
  historyEditionRootClassName,
} from './history-panel-chrome';

const here = dirname(fileURLToPath(import.meta.url));
const historyEditionCss = readFileSync(join(here, 'history-edition.css'), 'utf8');

test('history edition root class matches CSS scaffold', () => {
  assert.equal(historyEditionRootClassName(), HISTORY_EDITION_ROOT_CLASS);
  assert.equal(HISTORY_EDITION_ROOT_CLASS, 'ds-history-edition');
});

test('history edition panel class includes beat variant modifiers', () => {
  assert.equal(historyEditionPanelClassName(), HISTORY_EDITION_PANEL_CLASS);
  assert.equal(
    historyEditionPanelClassName('timeline'),
    'ds-history-edition__panel ds-history-edition__panel--timeline',
  );
  assert.equal(
    historyEditionPanelClassName('records'),
    'ds-history-edition__panel ds-history-edition__panel--records',
  );
});

test('decade scrubber reuses explore edition class constants', () => {
  assert.equal(HISTORY_DECADE_STEPPER_CLASS, 'ds-explore-edition__decade-stepper');
  assert.equal(HISTORY_DECADE_LIST_CLASS, 'ds-explore-edition__decade-list');
  assert.equal(HISTORY_DECADE_TAB_CLASS, 'ds-explore-edition__decade-tab');
});

test('sticky decade scrubber and records panel clear the fixed shell header', () => {
  // Regression: top: var(--ds-space-3) parked the scrubber under z-index 80 header.
  assert.match(
    historyEditionCss,
    /\.ds-history-edition__stepper-sticky\s*\{[^}]*top:\s*var\(--ds-island-clearance\)/s,
  );
  assert.match(
    historyEditionCss,
    /\.ds-history-edition__panel--records\s*\{[^}]*top:\s*calc\(var\(--ds-island-clearance\)\s*\+\s*3rem\)/s,
  );
  assert.doesNotMatch(
    historyEditionCss,
    /\.ds-history-edition__stepper-sticky\s*\{[^}]*top:\s*var\(--ds-space-3\)/s,
  );
});
