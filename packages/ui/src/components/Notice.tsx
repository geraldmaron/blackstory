/**
 * Notice for notes, warnings, disputes, errors and confirmations, with a mono cue label so the
 * tone is never carried by color alone.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (e.g. Next.js apps with `"jsx": "preserve"`), where the JSX below
// compiles to `React.createElement(...)` calls that need `React` in scope.
void React;

/**
 * `note` is for information that is not a problem: a privacy explanation or what happens next.
 * Drawing those as warnings taught readers to skip the warnings that matter.
 *
 * `success` exists because a confirmation was being drawn as a warning: the submit lead form
 * announced "Lead received" with `tone="warning"`, so a receipt was cued as a problem. It
 * announces politely like the other non-error tones.
 */
export type NoticeTone = 'note' | 'warning' | 'dispute' | 'error' | 'success';

export type NoticeProps = {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const CUES: Record<NoticeTone, string> = {
  note: 'Note',
  warning: 'Warning',
  dispute: 'Disputed',
  error: 'Error',
  success: 'Done',
};

export function Notice({ tone, title, children, className }: NoticeProps) {
  return (
    <div
      className={cx('ds-notice', `ds-notice--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="ds-notice__cue" aria-hidden="true">
        {CUES[tone]}
      </span>
      <div>
        <p className="ds-notice__title">
          <span className="ds-visually-hidden">{CUES[tone]}: </span>
          {title}
        </p>
        <div className="ds-notice__body">{children}</div>
      </div>
    </div>
  );
}
