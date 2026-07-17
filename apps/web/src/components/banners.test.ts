/**
 * SSR markup smoke tests for the disclaimer/sensitivity/advisory banner components.
 * Mirrors the render-to-static-markup pattern used by @black-book/ui's semantics.test.ts.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { AdvisoryNotice } from './AdvisoryNotice';
import { DisclaimerBanner, type DisclaimerCopy } from './DisclaimerBanner';
import { SensitivityContextBanner } from './SensitivityContextBanner';

const SENSITIVE_CONTENT_COPY: DisclaimerCopy = {
  title: 'Sensitive content',
  body: 'This record documents historical events or conduct involving violence or discrimination.',
  reviewDate: '2026-07-17',
};

const NON_ENDORSEMENT_COPY: DisclaimerCopy = {
  title: 'Inclusion is not endorsement',
  body: "A figure's inclusion in this index is never an endorsement of that individual's actions.",
  reviewDate: '2026-07-17',
};

const SAFETY_ADVISORY_COPY: DisclaimerCopy = {
  title: 'Present-day advisory',
  body: 'Present-day advisories are dated, sourced claims — not a real-time safety assessment.',
  reviewDate: '2026-07-17',
};

// A phrase list mirroring PROHIBITED_ADVISORY_LANGUAGE IDENTITY_ATTRIBUTE_TERMS in
// packages/domain kept local (not imported) since those symbols aren't in the domain package's
// public barrel yet.
const DANGER_FRAMING_TERMS = ['dangerous', 'danger', 'unsafe', 'hazardous', 'risky'];

test('DisclaimerBanner renders title, body, and review date through the shared Notice (warning tone, status role)', () => {
  const html = renderToStaticMarkup(createElement(DisclaimerBanner, SENSITIVE_CONTENT_COPY));
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.match(html, /Sensitive content/);
  assert.match(html, /Reviewed 2026-07-17/);
});

test('SensitivityContextBanner renders the flag note and sensitive-content disclaimer, never a numeric score', () => {
  const html = renderToStaticMarkup(
    createElement(SensitivityContextBanner, {
      sensitivity: {
        class: 'contested_legacy',
        note: 'Documented role in a contested 1930s land dispute.',
        basisClaimIds: ['claim_1'],
      },
      classLabel: 'Contested legacy',
      sensitiveContentDisclaimer: SENSITIVE_CONTENT_COPY,
    }),
  );
  assert.match(html, /Contested legacy/);
  assert.match(html, /Documented role in a contested 1930s land dispute\./);
  assert.match(html, /This record documents historical events/);
  assert.doesNotMatch(html, /score/i);
});

test('SensitivityContextBanner renders non-endorsement copy for person-kind flagged entities only', () => {
  const personHtml = renderToStaticMarkup(
    createElement(SensitivityContextBanner, {
      sensitivity: {
        class: 'perpetrator_associated',
        note: 'Documented as an organizer of a 1919 mob action per court record.',
        basisClaimIds: ['claim_2'],
      },
      classLabel: 'Associated with documented perpetration',
      sensitiveContentDisclaimer: SENSITIVE_CONTENT_COPY,
      nonEndorsementDisclaimer: NON_ENDORSEMENT_COPY,
      entityKind: 'person',
    }),
  );
  assert.match(personHtml, /never an endorsement/);

  const placeHtml = renderToStaticMarkup(
    createElement(SensitivityContextBanner, {
      sensitivity: {
        class: 'violence_associated',
        note: 'Site of a documented 1921 mob action per contemporaneous news account.',
        basisClaimIds: ['claim_3'],
      },
      classLabel: 'Associated with documented violence',
      sensitiveContentDisclaimer: SENSITIVE_CONTENT_COPY,
      nonEndorsementDisclaimer: NON_ENDORSEMENT_COPY,
      entityKind: 'place',
    }),
  );
  assert.doesNotMatch(placeHtml, /never an endorsement/);
});

test('SensitivityContextBanner never renders a suppression/hide affordance — it is additive markup only', () => {
  const html = renderToStaticMarkup(
    createElement(SensitivityContextBanner, {
      sensitivity: { class: 'enslaver_or_segregationist', note: 'Documented plantation ownership per probate record.', basisClaimIds: ['claim_4'] },
      classLabel: 'Documented enslaver or segregationist conduct',
      sensitiveContentDisclaimer: SENSITIVE_CONTENT_COPY,
    }),
  );
  // The component always renders visible content for a given flag there is no prop or branch
  // that yields an empty/hidden result while a sensitivity record is passed in. Matches the
  // standalone "hidden" token (an HTML `hidden` attribute or `visibility: hidden`) but not
  // `aria-hidden`/`bb-visually-hidden` those are legitimate, unrelated accessibility markup
  // (a decorative icon and screen-reader-only text respectively), not content suppression.
  assert.ok(html.length > 0);
  assert.doesNotMatch(html, /(?<![\w-])hidden(?![\w-])/i);
  assert.doesNotMatch(html, /display:\s*none/i);
});

test('AdvisoryNotice renders a dated, cited, procedural statement with no danger framing or numeric score', () => {
  const html = renderToStaticMarkup(
    createElement(AdvisoryNotice, {
      classLabel: 'Private property',
      statement: 'Private property as of 2024-03-01, per County Assessor parcel record.',
      reviewCadence: 'annual',
      safetyAdvisoryDisclaimer: SAFETY_ADVISORY_COPY,
    }),
  );
  assert.match(html, /Private property as of 2024-03-01, per County Assessor parcel record\./);
  assert.match(html, /Review cadence: annual\./);
  assert.match(html, /not a real-time safety assessment/);
  assert.doesNotMatch(html, /score/i);
  for (const term of DANGER_FRAMING_TERMS) {
    assert.doesNotMatch(html, new RegExp(term, 'i'));
  }
});

test('AdvisoryNotice source and rendered output never contain "dangerous today" framing across every advisory class', () => {
  const classLabels = [
    'Private property',
    'Access restricted',
    'Site no longer standing',
    'Verify before traveling',
    'Official travel advisory on record',
  ];
  for (const classLabel of classLabels) {
    const html = renderToStaticMarkup(
      createElement(AdvisoryNotice, {
        classLabel,
        statement: `${classLabel} as of 2024-01-01, per a cited source.`,
        reviewCadence: 'annual',
        safetyAdvisoryDisclaimer: SAFETY_ADVISORY_COPY,
      }),
    );
    assert.doesNotMatch(html, /dangerous today/i);
    for (const term of DANGER_FRAMING_TERMS) {
      assert.doesNotMatch(html, new RegExp(term, 'i'));
    }
  }
});
