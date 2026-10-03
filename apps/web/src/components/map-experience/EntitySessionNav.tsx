/**
 * Accessible Back / Next controls with an intentional Random toggle for entity session
 * browsing. Presentational only — parents own stack state and navigation side effects.
 * Random stays secondary + pressed styling so copper never fills body-size label text.
 */
import React from 'react';
import { Button } from '@repo/ui';

void React;

export type EntitySessionNavProps = {
  readonly canBack: boolean;
  readonly canNext: boolean;
  readonly randomEnabled: boolean;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onRandomToggle: () => void;
  readonly className?: string;
};

export function EntitySessionNav({
  canBack,
  canNext,
  randomEnabled,
  onBack,
  onNext,
  onRandomToggle,
  className,
}: EntitySessionNavProps) {
  const rootClass = ['ds-entity-session-nav', className].filter(Boolean).join(' ');

  return (
    <nav className={rootClass} aria-label="Record navigation">
      <Button
        type="button"
        className="ds-button--compact ds-entity-session-nav__control"
        variant="secondary"
        disabled={!canBack}
        aria-label="Back to previous record"
        onClick={onBack}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Back</span>
      </Button>
      <Button
        type="button"
        className="ds-button--compact ds-entity-session-nav__control ds-entity-session-nav__random"
        variant="secondary"
        aria-pressed={randomEnabled}
        aria-label={randomEnabled ? 'Random order: on' : 'Random order: off'}
        onClick={onRandomToggle}
      >
        {randomEnabled ? 'Random: on' : 'Random: off'}
      </Button>
      <Button
        type="button"
        className="ds-button--compact ds-entity-session-nav__control"
        variant="secondary"
        disabled={!canNext}
        aria-label={randomEnabled ? 'Next random record' : 'Next record in list'}
        onClick={onNext}
      >
        <span>Next</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    </nav>
  );
}
