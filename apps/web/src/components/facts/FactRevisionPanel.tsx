/**
 * Append-only revision history panel for a fact page.
 *
 * Every revision carries a mandatory edit summary and links to its per-revision permalink
 * (`/facts/{id}/rev/{n}`) — the Wikipedia-oldid hostile-quoting defense named in the.
 */
import React from 'react';
import {
  buildFactRevisionPath,
  type FactRecord,
  type FactRevision,
} from '@repo/domain/facts';
import { formatIsoDate, humanizeToken } from './format';

export type FactRevisionPanelProps = {
  readonly fact: Pick<FactRecord, 'id' | 'revisions'>;
  readonly currentRevisionNumber?: number;
  readonly labelledBy?: string;
};

function revisionAgentLabel(revision: FactRevision): string {
  return revision.agent.displayName ?? revision.agent.id;
}

export function FactRevisionPanel({ fact, currentRevisionNumber, labelledBy }: FactRevisionPanelProps) {
  if (fact.revisions.length === 0) {
    return (
      <p className="ds-sans" style={{ color: 'var(--ds-ink-muted)' }}>
        No revisions have been recorded for this fact yet.
      </p>
    );
  }

  return (
    <section {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
      <ol className="ds-sans" style={{ margin: 0, paddingLeft: 'var(--ds-space-5)' }}>
        {fact.revisions.map((revision) => {
          const isCurrent = currentRevisionNumber === revision.revisionNumber;
          return (
            <li key={revision.revisionNumber} style={{ marginBottom: 'var(--ds-space-3)' }}>
              <p style={{ margin: 0 }}>
                <strong>
                  Rev {revision.revisionNumber}
                  {isCurrent ? ' (this view)' : ''}
                </strong>
                {' — '}
                {revision.summary}
              </p>
              <p style={{ margin: 'var(--ds-space-1) 0 0 0', color: 'var(--ds-ink-muted)' }}>
                <span className="ds-mono">{humanizeToken(revision.changeType)}</span>
                {' · '}
                {revisionAgentLabel(revision)} · {formatIsoDate(revision.timestamp)}
              </p>
              {!isCurrent ? (
                <p style={{ margin: 'var(--ds-space-1) 0 0 0' }}>
                  <a href={buildFactRevisionPath(fact.id, revision.revisionNumber)}>View revision permalink</a>
                </p>
              ) : null}
              {revision.diff.length > 0 ? (
                <ul style={{ margin: 'var(--ds-space-2) 0 0 0', paddingLeft: 'var(--ds-space-5)' }}>
                  {revision.diff.map((entry) => (
                    <li key={`${revision.revisionNumber}_${entry.field}`}>
                      <span className="ds-mono">{entry.field}</span>: {entry.before ?? '∅'} → {entry.after ?? '∅'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
