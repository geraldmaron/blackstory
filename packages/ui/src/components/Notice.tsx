
/**
 * Status notice for warning, dispute, and error with mono cue labels (not color-only).
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (e.g. Next.js apps with `"jsx": "preserve"`), where the JSX below
// compiles to `React.createElement(...)` calls that need `React` in scope.
void React;

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
      className={cx('bp-notice', `bp-notice--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="bp-notice__cue" aria-hidden="true">
        {CUES[tone]}
      </span>
      <div>
        <p className="bp-notice__title">
          <span className="bp-visually-hidden">{CUES[tone]}: </span>
          {title}
        </p>
        <div className="bp-notice__body">{children}</div>
      </div>
    </div>
  );
}
