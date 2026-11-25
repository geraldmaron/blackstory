/**
 * Form fields and the numbered step a receipt lists: the label, hint and error wiring every public
 * form shares. Styles: page-kit.css.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

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
    <div className={cx('ds-doc-field', className)} data-invalid={error ? 'true' : undefined}>
      <label className="ds-doc-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="ds-doc-field__hint" id={fieldHintId(htmlFor)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ds-doc-field__error" id={fieldErrorId(htmlFor)} role="alert">
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
      className={cx('ds-doc-field', className)}
      data-invalid={error ? 'true' : undefined}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
    >
      <legend className="ds-doc-field__label">{legend}</legend>
      <div className="ds-doc-field__choices">
        {/*
         * The group reads as one control, so only the first radio carries the invalid state
         * and the id the form focuses. Marking every radio would announce the error once per
         * choice.
         */}
        {choices.map((choice, index) => (
          <label className="ds-doc-field__choice" key={choice.value}>
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
        <p className="ds-doc-field__hint" id={fieldHintId(groupId)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ds-doc-field__error" id={fieldErrorId(groupId)} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/* —— NumberedStep —————————————————————————————————————————————————————————— */

export type NumberedStepProps = {
  /** Step number, or a check when done. */
  readonly index: number;
  readonly title: ReactNode;
  /** Mono sub-line: timestamp, state, who has it. */
  readonly detail?: string;
  readonly done?: boolean;
  readonly className?: string;
};

export function NumberedStep({ index, title, detail, done = false, className }: NumberedStepProps) {
  return (
    <div className={cx('ds-doc-ustep', className)} data-done={done ? '1' : '0'}>
      <span className="ds-doc-ustep__i" aria-hidden="true">
        {done ? '✓' : index}
      </span>
      <span className="ds-doc-ustep__t">
        {/* The check mark is decorative; the state has to be in the text a screen reader gets. */}
        <span className="ds-visually-hidden">{done ? 'Done: ' : 'Not yet: '}</span>
        {title}
        {detail ? <small>{detail}</small> : null}
      </span>
    </div>
  );
}
