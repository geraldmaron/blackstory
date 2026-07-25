/**
 * Contract tests for beta disable config keys and runbook hooks.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertBetaDisableConfigDocumented,
  assertBetaDisableConfigKeys,
  BETA_DISABLE_CONTROLS,
  PUBLIC_STATIC_MODE_SWITCH_ID,
} from './beta-kill-switch.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

test('beta disable controls inventory includes the static-mode switch', () => {
  const keys = BETA_DISABLE_CONTROLS.map((control) => control.key);
  assert.ok(keys.includes(PUBLIC_STATIC_MODE_SWITCH_ID));
});

test('public-static-mode kill switch is registered', () => {
  assert.doesNotThrow(() => assertBetaDisableConfigKeys(repoRoot));
});

test('disable runbook documents env flag and kill switch', () => {
  assert.doesNotThrow(() => assertBetaDisableConfigDocumented(repoRoot));
});
