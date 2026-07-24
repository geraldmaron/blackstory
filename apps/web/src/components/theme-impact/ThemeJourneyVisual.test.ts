/**
 * Journey ink-sketch visuals for theme beats.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { ThemeJourneyVisual, themeJourneySceneForBeat } from './ThemeJourneyVisual';

test('themeJourneySceneForBeat returns redlining scenes', () => {
  const q1 = themeJourneySceneForBeat('redlining', 'Q1');
  assert.ok(q1);
  assert.match(q1.person, /Eugene Williams/);
  assert.match(q1.place, /29th Street Beach/);

  assert.equal(themeJourneySceneForBeat('drug_policy_state', 'Q5'), undefined);
});

test('ThemeJourneyVisual renders sketch and scene caption for Q2', () => {
  const scene = themeJourneySceneForBeat('redlining', 'Q2');
  assert.ok(scene);

  const html = renderToStaticMarkup(
    createElement(ThemeJourneyVisual, {
      questionId: 'Q2',
      scene: scene!,
      headingId: 'test-q2-visual',
    }),
  );

  assert.match(html, /ds-journey-sketch/);
  assert.match(html, /HOLC surveyor/);
  assert.match(html, /683 graded areas/);
  assert.doesNotMatch(html, /—/);
});
