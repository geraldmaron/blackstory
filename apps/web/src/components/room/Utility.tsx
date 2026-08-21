/**
 * Disclosure, Field, UtilityCard and UtilityStep — the task-surface blocks.
 *
 * Disclosure uses a native `<details>`: a task surface has to work before hydration, and a
 * hand-rolled collapse is the pattern that loses keyboard support first.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

/* —— Disclosure ————————————————————————————————————————————————————————————— */

export type DisclosureProps = {
  readonly summary: string;
  readonly children: ReactNode;
  /** Open on first paint. Collapsed by default: a drawer's job is to not be in the way. */
  readonly defaultOpen?: boolean;
  readonly className?: string;
};

export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <details className={cx('ds-room-draw', className)} open={defaultOpen}>
      <summary className="ds-room-draw__summary">{summary}</summary>
      <div className="ds-room-draw__body">{children}</div>
    </details>
  );
}

/* —— Field —————————————————————————————————————————————————————————————————— */

export type FieldProps = {
  readonly label: ReactNode;
  /** Id of the control inside, so the label is a real `<label for>`. */
  readonly htmlFor: string;
  /**
   * One line under the control saying how to answer — "Plain language is fine. You do not need
   * to write like a citation." Distinct from an error, which the caller renders itself.
   */
  readonly hint?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cx('ds-room-field', className)}>
      <label className="ds-room-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="ds-room-field__hint">{hint}</p> : null}
    </div>
  );
}

/* —— ChoiceField ————————————————————————————————————————————————————————————— */

export type Choice = {
  readonly value: string;
  readonly label: string;
};

export type ChoiceFieldProps = {
  readonly legend: ReactNode;
  /** Submitted field name, shared by every radio in the set. */
  readonly name: string;
  readonly choices: readonly Choice[];
  readonly defaultValue?: string;
  readonly required?: boolean;
  readonly hint?: ReactNode;
  readonly className?: string;
};

/**
 * A question whose answer is one of a small closed set, drawn as pills.
 *
 * Real radios in a fieldset, not buttons: this has to submit with JavaScript off, and it has to
 * announce as "one of four" to a screen reader. A select would also do both, but a set this
 * small is faster to read than it is to open.
 */
export function ChoiceField({
  legend,
  name,
  choices,
  defaultValue,
  required,
  hint,
  className,
}: ChoiceFieldProps) {
  return (
    <fieldset className={cx('ds-room-field', className)}>
      <legend className="ds-room-field__label">{legend}</legend>
      <div className="ds-room-field__choices">
        {choices.map((choice) => (
          <label className="ds-room-field__choice" key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              defaultChecked={defaultValue === choice.value}
              {...(required ? { required: true } : {})}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="ds-room-field__hint">{hint}</p> : null}
    </fieldset>
  );
}

/* —— UtilityCard / UtilityStep ————————————————————————————————————————————— */

export type UtilityCardProps = {
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function UtilityCard({ title, children, className }: UtilityCardProps) {
  return (
    <section className={cx('ds-room-ucard', className)}>
      {title ? <h2 className="ds-room-ucard__title">{title}</h2> : null}
      {children}
    </section>
  );
}

export type UtilityStepProps = {
  /** Step number, or a check when done. */
  readonly index: number;
  readonly title: ReactNode;
  /** Mono sub-line: timestamp, state, who has it. */
  readonly detail?: string;
  readonly done?: boolean;
  readonly className?: string;
};

export function UtilityStep({ index, title, detail, done = false, className }: UtilityStepProps) {
  return (
    <div className={cx('ds-room-ustep', className)} data-done={done ? '1' : '0'}>
      <span className="ds-room-ustep__i" aria-hidden="true">
        {done ? '✓' : index}
      </span>
      <span className="ds-room-ustep__t">
        {title}
        {detail ? <small>{detail}</small> : null}
      </span>
    </div>
  );
}
