/**
 * Status notice for warning, dispute, and error with mono cue labels (not color-only).
 */

import type { ReactNode } from 'react';
import { cx } from '../utils/cx.js';

export type NoticeTone = 'warning' | 'dispute' | 'error';

export type NoticeProps = {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const CUES: Record<NoticeTone, string> = {
  warning: 'Warning',
  dispute: 'Disputed',
  error: 'Error',
};

export function Notice({ tone, title, children, className }: NoticeProps) {
  return (
    <div
      className={cx('bb-notice', `bb-notice--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="bb-notice__cue" aria-hidden="true">
        {CUES[tone]}
      </span>
      <div>
        <p className="bb-notice__title">
          <span className="bb-visually-hidden">{CUES[tone]}: </span>
          {title}
        </p>
        <div className="bb-notice__body">{children}</div>
      </div>
    </div>
  );
}
