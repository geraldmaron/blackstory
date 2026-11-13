/**
 * The law index's wait: its own header and toolbar band over blank rows of the real row's
 * geometry, so nothing jumps when the chronology arrives. No count is invented.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../components/room';
import '../reading-room.css';
import './law.css';

void React;

const ROWS = 8;

export default function Loading() {
  return (
    <Room width="wide" className="ds-law">
      <div aria-busy="true">
        <PageHeader
          title="Law"
          dek={
            <span role="status" aria-live="polite">
              Pulling the laws together…
            </span>
          }
        />
        <div className="ds-records-toolbar" aria-hidden="true">
          <div className="ds-records-toolbar__inner" />
        </div>
        <ol className="ds-law-list ds-law-list--waiting" aria-hidden="true">
          {Array.from({ length: ROWS }, (_, index) => (
            <li className="ds-law-row" key={index}>
              <span className="ds-law-row__link">
                <span className="ds-law-row__year">
                  <span className="ds-records-wait" style={{ width: '3rem' }} />
                </span>
                <span className="ds-law-row__name">
                  <span
                    className="ds-records-wait"
                    style={{ width: `${30 + ((index * 17) % 30)}%` }}
                  />
                </span>
                <span className="ds-law-row__gloss">
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
