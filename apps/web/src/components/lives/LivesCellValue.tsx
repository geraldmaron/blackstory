import React from 'react';
import type { LivesCell, LivesMetricUnit } from '@repo/domain/statistics/lives';
import { describeLivesCell } from '../../lib/lives/lives-format';

void React;

export type LivesCellValueProps = {
  readonly cell: LivesCell;
  readonly unit: LivesMetricUnit;
};

/** One table cell's value with its margin, record count, or the reason it is missing. */
export function LivesCellValue({ cell, unit }: LivesCellValueProps) {
  const display = describeLivesCell(cell, unit);
  return (
    <span className={`lives-cell lives-cell--${display.tone}`} data-state={cell.state}>
      <span className="lives-cell__value">{display.text}</span>
      {display.detail ? <span className="lives-cell__detail">{display.detail}</span> : null}
    </span>
  );
}
