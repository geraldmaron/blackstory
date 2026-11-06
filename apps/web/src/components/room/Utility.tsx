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
   * to write like a citation."
   */
  readonly hint?: ReactNode;
  /**
   * The reason this answer was rejected. The field owns how an error is drawn, announced and
   * linked; it used to say "the caller renders itself", and every caller then wired a different
   * subset — some linked `aria-describedby`, none ever set `aria-invalid`, and a field whose
   * control it did not own (the radios) could not show an error at all.
   */
  readonly error?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

/** Stable ids for the two things a control can be described by. */
export const fieldHintId = (htmlFor: string) => `${htmlFor}-hint`;
export const fieldErrorId = (htmlFor: string) => `${htmlFor}-error`;

/**
 * The accessibility wiring for a control inside a `Field`, as one spread.
 *
 * Callers own their own `<input>`/`<select>`/`<textarea>` because the markup varies, so the
 * link between control, hint and error has to be handed to them rather than cloned onto their
 * element. Spreading this is the whole contract: correct `id`, both descriptions in the right
 * order, and `aria-invalid` whenever there is an error.
 */
export function fieldControlProps({
  htmlFor,
  hint,
  error,
}: {
  readonly htmlFor: string;
  readonly hint?: unknown;
  readonly error?: unknown;
}) {
  const describedBy = [hint ? fieldHintId(htmlFor) : null, error ? fieldErrorId(htmlFor) : null]
    .filter(Boolean)
    .join(' ');
  return {
    id: htmlFor,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
  };
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cx('ds-room-field', className)} data-invalid={error ? 'true' : undefined}>
      <label className="ds-room-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="ds-room-field__hint" id={fieldHintId(htmlFor)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ds-room-field__error" id={fieldErrorId(htmlFor)} role="alert">
          {error}
        </p>
      ) : null}
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
  /**
   * Same contract as `Field`. This set owns its own inputs, so unlike `Field` it can wire the
   * group itself. Before this existed the corrections form passed its category error in as a
   * `hint`, which rendered as ordinary help text and was never announced.
   */
  readonly error?: ReactNode;
  /** Needed to link the hint and error to the group; defaults to the field name. */
  readonly id?: string;
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
  error,
  id,
  className,
}: ChoiceFieldProps) {
  const groupId = id ?? name;
  const describedBy = [hint ? fieldHintId(groupId) : null, error ? fieldErrorId(groupId) : null]
    .filter(Boolean)
    .join(' ');
  return (
    <fieldset
      className={cx('ds-room-field', className)}
      data-invalid={error ? 'true' : undefined}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
    >
      <legend className="ds-room-field__label">{legend}</legend>
      <div className="ds-room-field__choices">
        {/*
         * The group reads as one control, so only the first radio carries the invalid state
         * and the id the form focuses. Marking every radio would announce the error once per
         * choice.
         */}
        {choices.map((choice, index) => (
          <label className="ds-room-field__choice" key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              defaultChecked={defaultValue === choice.value}
              {...(required ? { required: true } : {})}
              {...(error && index === 0 ? { 'aria-invalid': true as const, id: groupId } : {})}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
      {hint ? (
        <p className="ds-room-field__hint" id={fieldHintId(groupId)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ds-room-field__error" id={fieldErrorId(groupId)} role="alert">
          {error}
        </p>
      ) : null}
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
