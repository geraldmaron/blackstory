/**
 * The parts every public form shares, so the lead form, the correction form, the receipt lookup
 * and the appeal and abuse forms read as one family: one required-marking convention, one submit
 * row with a loading state, one failure message, and one "what happens next" aside.
 *
 * Fields themselves are the room kit's `Field` (label above, hint and error below, wired by
 * `fieldControlProps`). Styles: `./form-kit.css`.
 *
 * REQUIRED MARKING. A required field ends its label with an asterisk, and the form opens with one
 * line saying so. Optional fields carry no word at all. Screen readers hear "required" from the
 * control's own `required` attribute and from the hidden word beside the mark.
 */
import React, { type ReactNode } from 'react';
import { Button, cx } from '@repo/ui';

void React;

export function RequiredMark() {
  return (
    <>
      <span className="ds-form-required" aria-hidden="true">
        {' '}
        *
      </span>
      <span className="ds-visually-hidden"> (required)</span>
    </>
  );
}

export function RequiredNote() {
  return (
    <p className="ds-form-note">
      Fields marked <span aria-hidden="true">*</span>
      <span className="ds-visually-hidden">with an asterisk</span> are required.
    </p>
  );
}

/** The form beside its aside on desktop; the aside after the form on phone. */
export function FormLayout({
  children,
  aside,
  className,
}: {
  readonly children: ReactNode;
  readonly aside: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cx('ds-form-layout', className)}>
      <div className="ds-form-layout__main">{children}</div>
      <aside className="ds-form-layout__aside" aria-labelledby="form-next-heading">
        {aside}
      </aside>
    </div>
  );
}

/** What happens after the button, in the order it happens. */
export function NextSteps({
  steps,
  children,
}: {
  readonly steps: readonly string[];
  readonly children?: ReactNode;
}) {
  return (
    <>
      <h2 className="ds-form-next__title" id="form-next-heading">
        What happens next
      </h2>
      <ol className="ds-form-next__steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {children ? <div className="ds-form-next__more">{children}</div> : null}
    </>
  );
}

/** The one primary button, its pending label, and a line about what it does. */
export function SubmitRow({
  pending,
  label,
  pendingLabel,
  note,
  variant = 'primary',
}: {
  readonly pending: boolean;
  readonly label: string;
  readonly pendingLabel: string;
  readonly note?: ReactNode;
  readonly variant?: 'primary' | 'secondary';
}) {
  return (
    <div className="ds-form-submit">
      <Button type="submit" variant={variant} loading={pending} className="ds-form-submit__button">
        {pending ? pendingLabel : label}
      </Button>
      {note ? <p className="ds-form-submit__note">{note}</p> : null}
    </div>
  );
}

/** The send failed. Says nothing typed was lost, and what to do. */
export function FormFailure({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="ds-form-failure" role="alert">
      <p className="ds-form-failure__title">{title}</p>
      <div className="ds-form-failure__body">{children}</div>
    </div>
  );
}
