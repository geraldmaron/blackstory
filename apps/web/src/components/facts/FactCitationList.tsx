/**
 * Renders a fact's CSL-JSON citations plus BlackStory extension fields.
 *
 * Web citations prefer the archived capture URL as the outbound link; offline citations show the
 * excerpt and retrieval date without inventing a live URL. Full bibliography formatting via
 * citation.js is a parent-package dependency this component renders the stored CSL-JSON fields
 * directly until `@citation-js/core` is wired in `apps/web/package.json`.
 */
import React from 'react';
import { Card, Citation } from '@repo/ui';
import type { FactCitation } from '@repo/domain/facts';
import { formatIsoDate, humanizeToken } from './format';

export type FactCitationListProps = {
  readonly citations: readonly FactCitation[];
  readonly labelledBy?: string;
};

function citationTitle(citation: FactCitation): string {
  return citation.csl.title ?? citation.csl.id;
}

function citationHref(citation: FactCitation): string | undefined {
  return citation.archivedUrl ?? citation.csl.URL ?? citation.url;
}

export function FactCitationList({ citations, labelledBy }: FactCitationListProps) {
  if (citations.length === 0) {
    return (
      <p className="ds-sans" style={{ color: 'var(--ds-ink-muted)' }}>
        No citations are attached to this fact record.
      </p>
    );
  }

  return (
    <ol
      className="ds-stack"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
    >
      {citations.map((citation) => {
        const href = citationHref(citation);
        return (
          <li key={citation.csl.id}>
            <Card
              title={citationTitle(citation)}
              meta={
                <span className="ds-mono">
                  {humanizeToken(citation.sourceClass)} · {humanizeToken(citation.role)}
                </span>
              }
              as="article"
            >
              <blockquote
                className="ds-sans"
                style={{
                  margin: '0 0 var(--ds-space-3) 0',
                  paddingLeft: 'var(--ds-space-4)',
                  borderLeft: '2px solid var(--ds-border)',
                }}
              >
                {citation.excerpt}
              </blockquote>
              <Citation
                source={citationTitle(citation)}
                label={`${humanizeToken(citation.sourceClass)} source`}
                {...(href ? { href } : {})}
              />
              <dl className="ds-sans" style={{ margin: 'var(--ds-space-3) 0 0 0' }}>
                {citation.accessedAt ? (
                  <>
                    <dt style={{ fontWeight: 600 }}>Retrieved</dt>
                    <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{formatIsoDate(citation.accessedAt)}</dd>
                  </>
                ) : null}
                {citation.archivedAt ? (
                  <>
                    <dt style={{ fontWeight: 600 }}>Archived capture</dt>
                    <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{formatIsoDate(citation.archivedAt)}</dd>
                  </>
                ) : null}
                {citation.pageLocator ? (
                  <>
                    <dt style={{ fontWeight: 600 }}>Locator</dt>
                    <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{citation.pageLocator}</dd>
                  </>
                ) : null}
                {citation.sourceNote ? (
                  <>
                    <dt style={{ fontWeight: 600 }}>Source note</dt>
                    <dd style={{ margin: 0 }}>{citation.sourceNote}</dd>
                  </>
                ) : null}
              </dl>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
