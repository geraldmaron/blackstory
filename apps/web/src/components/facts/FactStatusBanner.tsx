/**
 * Workflow-status banner for corrected/superseded/deprecated facts (BB-086 AC1).
 *
 * Status (workflow rank) is rendered separately from the confidence badge — the two axes are
 * never conflated in copy or layout.
 */
import React from 'react';
import { Notice } from '@black-book/ui';
import type { FactRecord } from '@black-book/domain';
import { humanizeToken, statusBannerTitle } from './format';

export type FactStatusBannerProps = {
  readonly fact: Pick<FactRecord, 'status' | 'confidenceNote'>;
};

export function FactStatusBanner({ fact }: FactStatusBannerProps) {
  const title = statusBannerTitle(fact.status);
  if (!title) return null;

  const tone = fact.status === 'deprecated' ? 'error' : fact.status === 'superseded' ? 'warning' : 'dispute';

  return (
    <Notice tone={tone} title={title}>
      <p style={{ margin: 0 }}>
        This record remains available at its permalink so a cited version can always be verified.
        Workflow status: <span className="bb-mono">{humanizeToken(fact.status)}</span>.
      </p>
      {fact.confidenceNote ? (
        <p style={{ margin: 'var(--bb-space-2) 0 0 0' }}>{fact.confidenceNote}</p>
      ) : null}
    </Notice>
  );
}
