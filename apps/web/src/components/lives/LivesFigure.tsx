/**
 * Figure anatomy for Lives charts: a reading sentence, the graphic, and the numbers in a disclosure.
 * Mirrors DataChartFrame without stealing the Data page's figure numbering.
 */
import React, { type ReactNode } from 'react';

void React;

export type LivesFigureProps = {
  readonly title: string;
  readonly reading?: ReactNode;
  readonly caption?: ReactNode;
  readonly children: ReactNode;
  readonly textAlternative: ReactNode;
  readonly ariaLabel: string;
};

export function LivesFigure({
  title,
  reading,
  caption,
  children,
  textAlternative,
  ariaLabel,
}: LivesFigureProps) {
  return (
    <figure className="lives-figure" aria-label={ariaLabel}>
      <figcaption className="lives-figure__head">
        <span className="lives-figure__title">{title}</span>
        {reading ? <span className="lives-figure__reading">{reading}</span> : null}
      </figcaption>
      <div className="lives-figure__viz">{children}</div>
      {caption ? <p className="lives-figure__caption">{caption}</p> : null}
      <details className="lives-figure__numbers">
        <summary>Show the numbers</summary>
        {textAlternative}
      </details>
    </figure>
  );
}
