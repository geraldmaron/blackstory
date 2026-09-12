/**
 * Unit coverage for the decline-reason surface on the correction status panel: rendered
 * plainly when a closed correction carries an `outcomeReason`, absent otherwise.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorrectionStatusPanel } from './CorrectionStatusPanel';
import type { PublicCorrectionStatus } from './public-status';

void React;

const BASE_STATUS: PublicCorrectionStatus = {
  phase: 'closed',
  receiptCode: 'BB-COR-0123456789ABCDEF',
  submittedAt: '2026-07-17T12:00:00.000Z',
  updatedAt: '2026-07-18T09:00:00.000Z',
  appealAvailable: true,
  classificationDispute: false,
};

describe('CorrectionStatusPanel', () => {
  it('renders the decline reason plainly when a closed correction carries one', () => {
    const html = renderToStaticMarkup(
      <CorrectionStatusPanel
        status={{ ...BASE_STATUS, outcomeReason: 'The record was not changed after review.' }}
      />,
    );
    assert.match(html, /Declined: The record was not changed after review\./);
  });

  it('renders no decline-reason line when the correction has no outcomeReason', () => {
    const html = renderToStaticMarkup(<CorrectionStatusPanel status={BASE_STATUS} />);
    assert.doesNotMatch(html, /Declined:/);
  });

  it('renders no decline-reason line for a still-open correction, even if outcomeReason were set', () => {
    const html = renderToStaticMarkup(
      <CorrectionStatusPanel
        status={{
          ...BASE_STATUS,
          phase: 'under_review',
          outcomeReason: 'The record was not changed after review.',
        }}
      />,
    );
    assert.doesNotMatch(html, /Declined:/);
  });
});
