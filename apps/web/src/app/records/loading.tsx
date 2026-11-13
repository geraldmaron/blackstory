/**
 * The register's wait: the page's own header and toolbar band over blank research rows of the
 * real row's geometry, so nothing jumps when the rows arrive. No count is invented.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../components/room';
import '../reading-room.css';
import './records-index.css';

void React;

const ROWS = 8;

export default function Loading() {
  return (
    <Room width="wide" className="ds-records">
      <div aria-busy="true">
        <PageHeader
          title="Records"
          dek={
            <span role="status" aria-live="polite">
              Pulling the records together…
            </span>
          }
        />
        <div className="ds-records-toolbar" aria-hidden="true">
          <div className="ds-records-toolbar__inner" />
        </div>
        <ol className="ds-records-list ds-records-list--waiting" aria-hidden="true">
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
      </div>
    </Room>
  );
}
