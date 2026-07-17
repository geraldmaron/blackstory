/**
 * SSR markup smoke test for the entity-page BB-095 sensitivity banner wrapper (BB-052 acceptance
 * criterion 7). Confirms it resolves the real registry-backed label/disclaimer text — never a
 * hand-typed duplicate — and that no non-endorsement disclaimer leaks onto a non-person kind.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { getDisclaimer, SENSITIVITY_CLASS_PRESENTATION_LABELS } from '@black-book/domain';
import { EntitySensitivityBanner } from './EntitySensitivityBanner';

test('renders the registry class label and sensitive-content disclaimer body for a place-kind entity', () => {
  const html = renderToStaticMarkup(
    createElement(EntitySensitivityBanner, {
      sensitivity: {
        class: 'contested_legacy',
        note: 'Documented dispute over a 1920s land-use displacement action.',
        basisClaimIds: ['claim_seed_005'],
      },
      entityKind: 'place',
    }),
  );
  assert.match(html, new RegExp(SENSITIVITY_CLASS_PRESENTATION_LABELS.contested_legacy));
  assert.match(html, /Documented dispute over a 1920s land-use displacement action\./);
  assert.match(html, new RegExp(getDisclaimer('sensitive_content').body.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('never renders the non-endorsement disclaimer for a non-person entity kind', () => {
  const html = renderToStaticMarkup(
    createElement(EntitySensitivityBanner, {
      sensitivity: {
        class: 'contested_legacy',
        note: 'Documented dispute.',
        basisClaimIds: ['claim_seed_005'],
      },
      entityKind: 'institution',
    }),
  );
  assert.doesNotMatch(html, new RegExp(getDisclaimer('non_endorsement').title));
});
