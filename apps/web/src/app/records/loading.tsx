/**
 * The register's wait: the page's own header and toolbar band over blank research rows of the
 * real row's geometry, so nothing jumps when the rows arrive. No count is invented.
 */
import React from 'react';
import { PageTitle, Sheet } from '@repo/ui';
import { Room } from '../../components/room';
import '../reading-room.css';
import './records-index.css';

void React;

const ROWS = 8;

export default function Loading() {
  return (
    <Room width="wide" className="ds-records">
      <div aria-busy="true">
        {/* The loaded page's own head (title at display scale, dek under it), so nothing jumps;
            the numeral is left out because no count is invented. */}
        <header className="ds-records-head">
          <PageTitle className="ds-records-head__title">Records</PageTitle>
          <p className="ds-records-head__dek" role="status" aria-live="polite">
            Pulling the records together…
          </p>
        </header>
        <div className="ds-records-toolbar" aria-hidden="true">
          <div className="ds-records-toolbar__inner" />
        </div>
        <Sheet className="ds-records-paper" aria-hidden="true">
          <ol className="ds-records-list ds-records-list--waiting">
            {Array.from({ length: ROWS }, (_, index) => (
              <li className="ds-record" key={index}>
                <span className="ds-record__link">
                  <span className="ds-record__name">
                    <span
                      className="ds-records-wait"
                      style={{ width: `${38 + ((index * 17) % 30)}%` }}
                    />
                  </span>
                  <span className="ds-record__summary">
                    <span className="ds-records-wait ds-records-wait--line" />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Sheet>
      </div>
    </Room>
  );
}
