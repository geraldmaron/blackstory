/**
 * MediaWiki-style revision chrome — "Updated {date}" ambient booster linking to
 * the public errata log when corrections exist. Fact revision permalinks were retired
 * with the public /facts surface; corrections surface on /errata.
 */
import React from 'react';
import Link from 'next/link';
import { currentFactRevision, type FactRecord } from '@repo/domain/facts';
import { formatIsoDate, humanizeToken } from '../facts/format';

export type RevisionUpdateChromeProps = {
  readonly fact: Pick<FactRecord, 'id' | 'updatedAt' | 'revisions' | 'status'>;
  readonly errataHref?: string;
};

export function RevisionUpdateChrome({ fact, errataHref = '/errata' }: RevisionUpdateChromeProps) {
  const revision = currentFactRevision(fact.revisions);
  const updatedLabel = formatIsoDate(revision?.timestamp ?? fact.updatedAt);
  const isCorrection = revision?.changeType === 'correction' || fact.status === 'corrected';
  const hasHistory = (revision?.revisionNumber ?? 0) > 1;

  return (
    <p className="ds-sans" role="status" style={{ margin: 0, color: 'var(--ds-ink-muted)' }}>
      Updated {updatedLabel}
      {hasHistory || isCorrection ? (
        <>
          {' '}
          —{' '}
          <Link href={errataHref}>
            {isCorrection ? 'see what changed (correction logged)' : 'see what changed'}
          </Link>
        </>
      ) : null}
      {isCorrection ? (
        <>
          {' '}
          · <Link href={errataHref}>public errata</Link>
        </>
      ) : null}
      {revision ? (
        <>
          {' '}
          · <span className="ds-mono">{humanizeToken(revision.changeType)}</span>
        </>
      ) : null}
    </p>
  );
}
