/** Shared source-neutral wait for public catalog routes; no invented counts or record identity. */
import React from 'react';
import { Room, ReadingEntry } from './index';
import './catalog-loading.css';

void React;

/**
 * The wait is the room's own masthead with the wait line as its title, over a blank ruled ledger:
 * the archive of record with its pages not yet written in. Hairlines only — filled grey slabs
 * read as a broken page, and a hairline reads as paper. The one moving part is the copper pin.
 */
export function CatalogLoading({
  pathname,
  label,
  note,
}: {
  readonly pathname: string;
  readonly label: string;
  /** One plain sentence about how the archive works. Never a count or a promise about content. */
  readonly note?: string;
}) {
  return (
    <Room ledger>
      <div aria-busy="true" className="ds-wait">
        <ReadingEntry
          pathname={pathname}
          showCrumb={false}
          title={
            <span role="status" aria-live="polite">
              {label}
            </span>
          }
          lede={note}
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
    </Room>
  );
}
