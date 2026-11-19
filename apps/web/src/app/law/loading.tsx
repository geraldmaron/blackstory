/**
 * The law index's wait: its own header, toolbar and sand axis band over a paper sheet of blank
 * rows of the real row's geometry, so nothing jumps when the chronology arrives. No count is invented.
 */
import React from 'react';
import { Block, PageHeader, Sheet } from '@repo/ui';
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
        <Block
          tone="sand"
          className="ds-law-axis-band ds-law-axis-band--waiting"
          aria-hidden="true"
        >
          <div className="ds-wrap" />
        </Block>
        <Sheet className="ds-law-sheet ds-law-sheet--flat" aria-hidden="true">
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
        </Sheet>
      </div>
    </Room>
  );
}
