/** Shared source-neutral wait for public catalog routes; no invented counts or record identity. */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { PageFrame } from './PageFrame';
import './catalog-loading.css';

void React;

/**
 * The wait is the page's own PageHeader with the wait line as its title, over a blank ruled ledger:
 * the archive of record with its pages not yet written in. Hairlines only — filled grey slabs
 * read as a broken page, and a hairline reads as paper. The one moving part is the copper pin.
 */
export function CatalogLoading({
  label,
  note,
}: {
  readonly label: string;
  /** One plain sentence about how the archive works. Never a count or a promise about content. */
  readonly note?: string;
}) {
  return (
    <PageFrame width="wide">
      <div aria-busy="true" className="ds-wait">
        <PageHeader
          title={
            <span role="status" aria-live="polite">
              {label}
            </span>
          }
          dek={note}
        />
        <div className="ds-wait__ledger" aria-hidden="true">
          <span className="ds-wait__rule ds-wait__rule--lead">
            <span className="ds-wait__pin" />
          </span>
          <span className="ds-wait__rule" />
          <span className="ds-wait__rule" />
          <span className="ds-wait__rule" />
          <span className="ds-wait__rule" />
        </div>
      </div>
    </PageFrame>
  );
}
