/**
 * Accessible Back / Next controls with an intentional Random toggle for entity session
 * browsing. Presentational only — parents own stack state and navigation side effects.
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
        className="ds-button--compact"
        variant="secondary"
        disabled={!canBack}
        aria-label="Back to previous record"
        onClick={onBack}
      >
        Back
      </Button>
      <Button
        type="button"
        className="ds-button--compact ds-entity-session-nav__random"
        variant={randomEnabled ? 'primary' : 'secondary'}
        aria-pressed={randomEnabled}
        aria-label={randomEnabled ? 'Random order: on' : 'Random order: off'}
        onClick={onRandomToggle}
      >
        {randomEnabled ? 'Random: on' : 'Random: off'}
      </Button>
      <Button
        type="button"
        className="ds-button--compact"
        variant="secondary"
        disabled={!canNext}
        aria-label={randomEnabled ? 'Next random record' : 'Next record in list'}
        onClick={onNext}
      >
        Next
      </Button>
    </nav>
  );
}
