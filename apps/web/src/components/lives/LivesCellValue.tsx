import React from 'react';
import type { LivesCell } from '@repo/domain/statistics/lives';
import { describeLivesCell } from '../../lib/lives/lives-format';

void React;

export type LivesCellValueProps = {
  readonly cell: LivesCell;
};

/**
 * One table cell's value with its margin, coverage or the reason it is missing. A missing value links
 * to the decade's count note when one explains it.
 */
export function LivesCellValue({ cell }: LivesCellValueProps) {
  const display = describeLivesCell(cell);
  return (
    <span className={`lives-cell lives-cell--${display.tone}`} data-state={cell.state}>
      <span className="lives-cell__value">{display.text}</span>
      {display.detail ? <span className="lives-cell__detail">{display.detail}</span> : null}
      {cell.noteId ? (
        <a className="lives-cell__why" href={`#lives-note-${cell.noteId}`}>
          Why
        </a>
      ) : null}
    </span>
  );
}
