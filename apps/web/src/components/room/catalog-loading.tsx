/** Shared source-neutral wait for public catalog routes; no invented counts or record identity. */
import React from 'react';
import { Room, ReadingEntry } from './index';
import '../patterns/skeleton.css';

void React;

export function CatalogLoading({
  pathname,
  label,
}: {
  readonly pathname: string;
  readonly label: string;
}) {
  return (
    <Room ledger>
      <div aria-busy="true">
        <p role="status" aria-live="polite">
          {label}
        </p>
        <div aria-hidden="true">
          <ReadingEntry
            pathname={pathname}
            showCrumb={false}
            title={<span className="ds-sk ds-sk--title ds-sk--w-60" />}
            lede={<span className="ds-sk ds-sk--text ds-sk--w-80" />}
          />
          <span className="ds-sk ds-sk--row ds-sk--w-full" />
          <span className="ds-sk ds-sk--row ds-sk--w-full" />
          <span className="ds-sk ds-sk--row ds-sk--w-80" />
        </div>
      </div>
    </Room>
  );
}
