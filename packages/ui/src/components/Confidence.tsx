/**
 * Confidence indicator with text/mono cue so status is never color-only.
 */

import type { ConfidenceLevel } from '../tokens/colors.js';
import { cx } from '../utils/cx.js';

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
    <span className={cx('bb-confidence', `bb-confidence--${level}`, className)} role="status">
      <span className="bb-confidence__mark" aria-hidden="true">
        {MARKS[level]}
      </span>
      <span>{text}</span>
    </span>
  );
}
