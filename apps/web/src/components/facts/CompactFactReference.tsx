/**
 * Compact embed/reference card for map, entity, and evidence surfaces.
 *
 * Renders the shared `CompactFactView` shape from `@repo/domain` one canonical URL and one
 * citation set, identical to the fact's own page. Uses Next.js `Link` for soft navigation.
 */
import React from 'react';
import Link from 'next/link';
import { Card, Citation } from '@repo/ui';
import type { CompactFactView } from '@repo/domain/facts';
import { humanizeToken } from './format';

export type CompactFactReferenceProps = {
  readonly view: CompactFactView;
};

export function CompactFactReference({ view }: CompactFactReferenceProps) {
  return (
    <Card
      title={view.shortStatement}
      meta={<span className="ds-mono">{view.id}</span>}
      as="article"
    >
      <p className="ds-sans" style={{ margin: '0 0 var(--ds-space-3) 0' }}>{view.statement}</p>
      <p className="ds-sans" style={{ margin: '0 0 var(--ds-space-3) 0', color: 'var(--ds-ink-muted)' }}>
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
      <p style={{ margin: 'var(--ds-space-3) 0 0 0' }}>
        <Link className="ds-cta ds-cta--ink" href={view.canonicalUrl}>
          Open canonical fact record
        </Link>
      </p>
    </Card>
  );
}
