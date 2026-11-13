'use client';

/**
 * The keyboard layer for a chart's marks. Every mark is a `[data-mark]` element carrying its own
 * value in `aria-label` and a tooltip shown on hover and focus by CSS alone, so a reader without
 * JavaScript still gets the hover detail. This wrapper adds one thing: the marks form a single tab
 * stop, and the arrow keys, Home and End walk between them. Only the focused mark is tabbable.
 */
import React, { useRef, type KeyboardEvent, type ReactNode } from 'react';

void React;

const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export function ChartMarks({
  label,
  className,
  children,
}: {
  /** What the chart plots, for the group's accessible name. */
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!KEYS.has(event.key) || !ref.current) return;
    const marks = Array.from(ref.current.querySelectorAll<HTMLElement>('[data-mark]'));
    const at = marks.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? marks.length - 1
          : Math.min(marks.length - 1, Math.max(0, at + (back ? -1 : 1)));
    marks.forEach((mark, index) => {
      mark.tabIndex = index === next ? 0 : -1;
    });
    marks[next]?.focus();
  }

  return (
    <div ref={ref} className={className} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
