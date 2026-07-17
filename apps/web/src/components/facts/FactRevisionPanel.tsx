/**
 * Append-only revision history panel for a fact page.
 *
 * Every revision carries a mandatory edit summary and links to its per-revision permalink
 * (`/facts/{id}/rev/{n}`) — the Wikipedia-oldid hostile-quoting defense named in the.
 */
import React from 'react';
import type { FactRecord, FactRevision } from '@black-book/domain';
import { buildFactRevisionPath } from '@black-book/domain';
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
      <p className="bb-sans" style={{ color: 'var(--bb-ink-muted)' }}>
        No revisions have been recorded for this fact yet.
      </p>
    );
  }

  return (
    <section {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
      <ol className="bb-sans" style={{ margin: 0, paddingLeft: 'var(--bb-space-5)' }}>
        {fact.revisions.map((revision) => {
          const isCurrent = currentRevisionNumber === revision.revisionNumber;
          return (
            <li key={revision.revisionNumber} style={{ marginBottom: 'var(--bb-space-3)' }}>
              <p style={{ margin: 0 }}>
                <strong>
                  Rev {revision.revisionNumber}
                  {isCurrent ? ' (this view)' : ''}
                </strong>
                {' — '}
                {revision.summary}
              </p>
              <p style={{ margin: 'var(--bb-space-1) 0 0 0', color: 'var(--bb-ink-muted)' }}>
                <span className="bb-mono">{humanizeToken(revision.changeType)}</span>
                {' · '}
                {revisionAgentLabel(revision)} · {formatIsoDate(revision.timestamp)}
              </p>
              {!isCurrent ? (
                <p style={{ margin: 'var(--bb-space-1) 0 0 0' }}>
                  <a href={buildFactRevisionPath(fact.id, revision.revisionNumber)}>View revision permalink</a>
                </p>
              ) : null}
              {revision.diff.length > 0 ? (
                <ul style={{ margin: 'var(--bb-space-2) 0 0 0', paddingLeft: 'var(--bb-space-5)' }}>
                  {revision.diff.map((entry) => (
                    <li key={`${revision.revisionNumber}_${entry.field}`}>
                      <span className="bb-mono">{entry.field}</span>: {entry.before ?? '∅'} → {entry.after ?? '∅'}
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
