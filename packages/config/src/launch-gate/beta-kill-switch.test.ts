/**
 * Contract tests for BB-063 beta disable config keys and runbook hooks.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertBetaDisableConfigDocumented,
  assertBetaDisableConfigKeys,
  BETA_DISABLE_CONTROLS,
  PUBLIC_READ_API_DISABLED_ENV,
  PUBLIC_STATIC_MODE_SWITCH_ID,
} from './beta-kill-switch.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

test('beta disable controls inventory includes env and static-mode switch', () => {
  const keys = BETA_DISABLE_CONTROLS.map((control) => control.key);
  assert.ok(keys.includes(PUBLIC_READ_API_DISABLED_ENV));
  assert.ok(keys.includes(PUBLIC_STATIC_MODE_SWITCH_ID));
});

test('App Hosting templates declare PUBLIC_READ_API_DISABLED default off', () => {
  assert.doesNotThrow(() => assertBetaDisableConfigKeys(repoRoot));
});

test('disable runbook documents env flag and kill switch', () => {
  assert.doesNotThrow(() => assertBetaDisableConfigDocumented(repoRoot));
});
