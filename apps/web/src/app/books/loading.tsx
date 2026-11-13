/**
 * The books index's wait: its own header and toolbar band over blank 2:3 cover frames, the
 * wall's real geometry, so nothing jumps when the covers arrive. No count is invented.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../components/room';
import '../reading-room.css';
import './book-cover.css';
import './books.css';

void React;

const COVERS = 12;

export default function Loading() {
  return (
    <Room width="wide" className="ds-books">
      <div aria-busy="true">
        <PageHeader
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
        <ul className="ds-books-wall" aria-hidden="true">
          {Array.from({ length: COVERS }, (_, index) => (
            <li key={index}>
              <span className="ds-books-wall__link">
                <span className="ds-book-cover ds-books-wall__cover ds-records-wait" />
                <span
                  className="ds-records-wait"
                  style={{ width: `${50 + ((index * 13) % 40)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Room>
  );
}
