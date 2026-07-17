/**
 * Tests for BB-051 map-overlay dignity-rule contract hooks (AC7).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertMapOverlayLayerConfigValid,
  assertNoDangerShadingStyleTerm,
  buildNarrativeOffRampLabel,
  MapOverlayDignityViolationError,
  MAP_OVERLAY_DIGNITY_RULES,
  PROHIBITED_MAP_OVERLAY_STYLE_TERMS,
} from './map-overlay.js';

test('MAP_OVERLAY_DIGNITY_RULES require opt-in, muted styling, and narrative off-ramp', () => {
  const rulesText = MAP_OVERLAY_DIGNITY_RULES.join(' ');
  assert.match(rulesText, /opt-in/i);
  assert.match(rulesText, /muted/i);
  assert.match(rulesText, /off-ramp/i);
});

test('assertMapOverlayLayerConfigValid accepts a valid muted opt-in overlay config', () => {
  assert.doesNotThrow(() =>
    assertMapOverlayLayerConfigValid({
      layerId: 'documented_events',
      tone: 'muted',
      optIn: true,
      narrativeOffRampUrl: '/entity/place_1#historic-safety',
    }),
  );
});

test('assertMapOverlayLayerConfigValid rejects blank narrativeOffRampUrl', () => {
  assert.throws(
    () =>
      assertMapOverlayLayerConfigValid({
        layerId: 'sundown_town',
        tone: 'muted',
        optIn: true,
        narrativeOffRampUrl: '   ',
      }),
    MapOverlayDignityViolationError,
  );
});

test('assertNoDangerShadingStyleTerm rejects prohibited style tokens', () => {
  for (const term of PROHIBITED_MAP_OVERLAY_STYLE_TERMS) {
    assert.throws(() => assertNoDangerShadingStyleTerm(`overlay-${term}-fill`), MapOverlayDignityViolationError);
  }
  assert.doesNotThrow(() => assertNoDangerShadingStyleTerm('overlay-muted-neutral-fill'));
});

test('buildNarrativeOffRampLabel links to evidence, never a standalone verdict', () => {
  const label = buildNarrativeOffRampLabel('exclusion_infrastructure');
  assert.match(label, /View the .* evidence for this place/);
  assert.doesNotMatch(label, /unsafe|danger/i);
});
