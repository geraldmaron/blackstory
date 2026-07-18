/**
 * Compact embed/reference card for map, entity, and evidence surfaces.
 *
 * Renders the shared `CompactFactView` shape from `@blap/domain` one canonical URL and one
 * citation set, identical to the fact's own page.
 */
import React from 'react';
import { Card, Citation } from '@blap/ui';
import type { CompactFactView } from '@blap/domain';
import { humanizeToken } from './format';

export type CompactFactReferenceProps = {
  readonly view: CompactFactView;
};

export function CompactFactReference({ view }: CompactFactReferenceProps) {
  return (
    <Card
      title={view.shortStatement}
      meta={<span className="bp-mono">{view.id}</span>}
      as="article"
    >
      <p className="bp-sans" style={{ margin: '0 0 var(--bp-space-3) 0' }}>{view.statement}</p>
      <p className="bp-sans" style={{ margin: '0 0 var(--bp-space-3) 0', color: 'var(--bp-ink-muted)' }}>
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
      <p style={{ margin: 'var(--bp-space-3) 0 0 0' }}>
        <a className="bp-cta bp-cta--ink" href={view.canonicalUrl}>
          Open canonical fact record
        </a>
      </p>
    </Card>
  );
}
