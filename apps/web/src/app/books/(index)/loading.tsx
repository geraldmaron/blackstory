/**
 * The books index's wait: its own header and toolbar over ruled placeholder rows on the sheet, so
 * nothing jumps when the titles arrive. No count is invented.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../../components/room';
import '../../reading-room.css';
import '../../parked.css';
import '../books.css';

void React;

const ROWS = 8;

export default function Loading() {
  return (
    <Room width="wide" className="ds-books">
      <div
        className="ds-parked ds-books-stage"
        data-ground="ink"
        data-ground-fixed=""
        aria-busy="true"
      >
        <div className="ds-parked__main">
          <PageHeader
            display
            className="ds-books-head"
            title="Banned books"
            dek={
              <span role="status" aria-live="polite">
                Taking the books off the shelf…
              </span>
            }
          />
          <div className="ds-records-toolbar" aria-hidden="true">
            <div className="ds-records-toolbar__inner" />
          </div>
          <div className="ds-parked__sheet ds-books-sheet" data-ground="paper" aria-hidden="true">
            <ul className="ds-books-list">
              {Array.from({ length: ROWS }, (_, index) => (
                <li key={index}>
                  <span className="ds-books-row">
                    <span
                      className="ds-records-wait"
                      style={{ width: `${50 + ((index * 13) % 40)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Room>
  );
}
