/**
 * Flat matte icon for home edition entry steps and record fact labels. Glyph +
 * visible text label always pair so icons are never the only signal (WCAG 1.4.1).
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '@repo/ui';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import {
  entryStepIconFor,
  recordEraIcon,
  recordEvidenceIconFor,
  recordKindIconFor,
  recordWhereIcon,
  type EntryStepKey,
} from './edition-fact-icon';

void React;

export type EditionFactIconProps =
  | {
      readonly variant: 'entry';
      readonly step: EntryStepKey;
      readonly className?: string;
    }
  | {
      readonly variant: 'record-kind';
      readonly kind: string;
      readonly mapTone?: string;
      /** When true, kind shade is suppressed for quieter anatomy panels. */
      readonly muted?: boolean;
      readonly className?: string;
    }
  | {
      readonly variant: 'record-where';
      readonly className?: string;
    }
  | {
      readonly variant: 'record-era';
      readonly className?: string;
    }
  | {
      readonly variant: 'record-evidence';
      readonly tier: ConfidenceTierKey;
      readonly className?: string;
    };

export function EditionFactIcon(props: EditionFactIconProps) {
  if (props.variant === 'entry') {
    return (
      <FontAwesomeIcon
        icon={iconWithFallback(entryStepIconFor(props.step))}
        className={cx('ds-edition-fact-icon', 'ds-edition-fact-icon--entry', props.className)}
        aria-hidden="true"
      />
    );
  }

  if (props.variant === 'record-kind') {
    const { icon, shade } = recordKindIconFor(props.kind, props.mapTone);
    const muted = props.muted === true;
    return (
      <FontAwesomeIcon
        icon={iconWithFallback(icon)}
        className={cx(
          'ds-edition-fact-icon',
          'ds-edition-fact-icon--kind',
          muted && 'ds-edition-fact-icon--kind-muted',
          props.className,
        )}
        {...(muted ? {} : { style: { color: shade } })}
        aria-hidden="true"
      />
    );
  }

  if (props.variant === 'record-where') {
    return (
      <FontAwesomeIcon
        icon={iconWithFallback(recordWhereIcon())}
        className={cx('ds-edition-fact-icon', 'ds-edition-fact-icon--where', props.className)}
        aria-hidden="true"
      />
    );
  }

  if (props.variant === 'record-era') {
    return (
      <FontAwesomeIcon
        icon={iconWithFallback(recordEraIcon())}
        className={cx('ds-edition-fact-icon', 'ds-edition-fact-icon--era', props.className)}
        aria-hidden="true"
      />
    );
  }

  if (props.variant === 'record-evidence') {
    const icon = iconWithFallback(recordEvidenceIconFor(props.tier));
    return (
      <FontAwesomeIcon
        icon={icon}
        className={cx(
          'ds-edition-fact-icon',
          'ds-edition-fact-icon--evidence',
          `ds-edition-fact-icon--evidence-${props.tier}`,
          props.className,
        )}
        aria-hidden="true"
      />
    );
  }

  const _exhaustive: never = props;
  void _exhaustive;
  return null;
}
