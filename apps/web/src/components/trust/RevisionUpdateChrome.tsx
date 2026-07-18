/**
 * MediaWiki-style revision chrome "Updated {date} see what changed" ambient booster
 * linking to per-revision permalinks and the errata log when corrections exist.
 */
import React from 'react';
import {
  buildFactRevisionPath,
  currentFactRevision,
  type FactRecord,
} from '@repo/domain/facts';
import { formatIsoDate, humanizeToken } from '../facts/format';

export type RevisionUpdateChromeProps = {
  readonly fact: Pick<FactRecord, 'id' | 'updatedAt' | 'revisions' | 'status'>;
  readonly errataHref?: string;
};

export function RevisionUpdateChrome({ fact, errataHref = '/errata' }: RevisionUpdateChromeProps) {
  const revision = currentFactRevision(fact.revisions);
  const updatedLabel = formatIsoDate(revision?.timestamp ?? fact.updatedAt);
  const latestPath =
    revision && revision.revisionNumber > 1
      ? buildFactRevisionPath(fact.id, revision.revisionNumber)
      : undefined;
  const isCorrection = revision?.changeType === 'correction' || fact.status === 'corrected';

  return (
    <p className="ds-sans" role="status" style={{ margin: 0, color: 'var(--ds-ink-muted)' }}>
      Updated {updatedLabel}
      {latestPath ? (
        <>
          {' '}
          —{' '}
          <a href={latestPath}>
            see what changed
            {isCorrection ? ' (correction logged)' : ''}
          </a>
        </>
      ) : null}
      {isCorrection ? (
        <>
          {' '}
          ·{' '}
          <a href={errataHref}>
            public errata
          </a>
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
