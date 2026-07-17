/**
 * Compact embed/reference card for map, entity, and evidence surfaces (BB-086 AC4).
 *
 * Renders the shared `CompactFactView` shape from `@black-book/domain` — one canonical URL and one
 * citation set, identical to the fact's own page.
 */
import React from 'react';
import { Card, Citation } from '@black-book/ui';
import type { CompactFactView } from '@black-book/domain';
import { humanizeToken } from './format';

export type CompactFactReferenceProps = {
  readonly view: CompactFactView;
};

export function CompactFactReference({ view }: CompactFactReferenceProps) {
  return (
    <Card
      title={view.shortStatement}
      meta={<span className="bb-mono">{view.id}</span>}
      as="article"
    >
      <p className="bb-sans" style={{ margin: '0 0 var(--bb-space-3) 0' }}>{view.statement}</p>
      <p className="bb-sans" style={{ margin: '0 0 var(--bb-space-3) 0', color: 'var(--bb-ink-muted)' }}>
        {humanizeToken(view.claimType)} · {humanizeToken(view.confidence)} · {view.citationCount}{' '}
        {view.citationCount === 1 ? 'citation' : 'citations'}
      </p>
      {view.primaryCitation ? (
        <Citation
          source={view.primaryCitation.sourceTitle}
          label={`${humanizeToken(view.primaryCitation.sourceClass)} source`}
          {...(view.primaryCitation.href ? { href: view.primaryCitation.href } : {})}
        />
      ) : null}
      <p style={{ margin: 'var(--bb-space-3) 0 0 0' }}>
        <a className="bb-cta bb-cta--ink" href={view.canonicalUrl}>
          Open canonical fact record
        </a>
      </p>
    </Card>
  );
}
