/**
 * Confidence indicator with text/mono cue so status is never color-only.
 */

import React from 'react';
import type { ConfidenceLevel } from '../tokens/colors.js';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type ConfidenceProps = {
  readonly level: ConfidenceLevel;
  readonly label?: string;
  readonly className?: string;
};

const MARKS: Record<ConfidenceLevel, string> = {
  high: '●●●',
  medium: '●●○',
  low: '●○○',
};

const DEFAULT_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export function Confidence({ level, label, className }: ConfidenceProps) {
  const text = label ?? DEFAULT_LABELS[level];
  return (
    <span
      className={cx('ds-confidence', `ds-confidence--${level}`, className)}
      data-tier={level}
      role="status"
    >
      <span className="ds-confidence__mark" aria-hidden="true">
        {MARKS[level]}
      </span>
      <span>{text}</span>
    </span>
  );
}
