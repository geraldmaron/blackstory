/**
 * The law index's wait: its rail, header and toolbar on the night ground beside a sheet of blank
 * rows of the real row's geometry, so nothing jumps when the chronology arrives. No count is invented.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../../components/room';
import '../../reading-room.css';
import '../../parked.css';
import '../law.css';

void React;

const ROWS = 8;

export default function Loading() {
  return (
    <Room width="wide" className="ds-law">
      <div
        className="ds-parked ds-parked--railed ds-law-stage"
        data-ground="ink"
        data-ground-fixed=""
        aria-busy="true"
      >
        <div className="ds-parked__main">
          <PageHeader
            display
            className="ds-law-head"
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
          <div className="ds-law-axis ds-law-axis--waiting" aria-hidden="true">
            <div className="ds-law-axis__track" />
          </div>
          <div className="ds-parked__sheet ds-law-sheet" data-ground="paper" aria-hidden="true">
            <ol className="ds-law-list ds-law-list--waiting">
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
        </div>
      </div>
    </Room>
  );
}
