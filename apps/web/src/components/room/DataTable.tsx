/**
 * DataTable — a table that scrolls inside its own container, never the page.
 *
 * The wrapper is not optional and is not a caller's responsibility: a wide table that pushes
 * the document sideways is the specific bug this component exists to make unrepeatable. The
 * scroll container is focusable and labeled so a keyboard reader can reach the overflow.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type DataTableColumn = {
  readonly key: string;
  readonly label: string;
  /** Right-aligned tabular mono. Use for any column of figures. */
  readonly numeric?: boolean;
};

export type DataTableProps = {
  readonly caption: string;
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly Readonly<Record<string, ReactNode>>[];
  /** Show the caption. Hidden by default: most rooms head the table with a GroupHeading. */
  readonly showCaption?: boolean;
  readonly className?: string;
};

export function DataTable({
  caption,
  columns,
  rows,
  showCaption = false,
  className,
}: DataTableProps) {
  return (
    <div className="ds-room-tblwrap" role="region" aria-label={caption} tabIndex={0}>
      <table className={cx('ds-room-tbl', className)}>
        <caption className={showCaption ? undefined : 'ds-visually-hidden'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.numeric ? 'ds-room-num' : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'ds-room-num' : undefined}>
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
