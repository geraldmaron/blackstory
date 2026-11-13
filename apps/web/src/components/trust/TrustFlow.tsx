/**
 * A process drawn as what it is: an ordered run of steps on one line, each with its rule.
 *
 * HTML, not an image, so the text reflows, reads in order to a screen reader and takes both
 * themes from the tokens. Across on wide screens, down the left edge below 40rem. The last step
 * is the outcome and is drawn filled; the others are hollow. Nothing here implies progress.
 */
import React from 'react';
import { cx } from '@repo/ui';

void React;

export type TrustFlowStep = {
  readonly title: string;
  readonly body: string;
};

export type TrustFlowProps = {
  /** What the flow is, for the figure's caption and its accessible name. */
  readonly caption: string;
  readonly steps: readonly TrustFlowStep[];
  /** One line under the flow: an exception or the rule that holds across every step. */
  readonly note?: React.ReactNode;
  readonly className?: string;
};

export function TrustFlow({ caption, steps, note, className }: TrustFlowProps) {
  return (
    <figure className={cx('ds-trust-flow', className)} data-ground="ink">
      <figcaption className="ds-trust-flow__caption">{caption}</figcaption>
      <ol
        className="ds-trust-flow__steps"
        style={{ '--flow-n': steps.length } as React.CSSProperties}
      >
        {steps.map((step, index) => (
          <li key={step.title} className="ds-trust-flow__step">
            <span className="ds-trust-flow__node" aria-hidden="true" />
            <span className="ds-trust-flow__n" aria-hidden="true">
              {index + 1}
            </span>
            <strong className="ds-trust-flow__title">{step.title}</strong>
            <span className="ds-trust-flow__body">{step.body}</span>
          </li>
        ))}
      </ol>
      {note ? <p className="ds-trust-flow__note">{note}</p> : null}
    </figure>
  );
}
