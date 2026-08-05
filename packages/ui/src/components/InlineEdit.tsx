/**
 * One field, one form, one audit event.
 *
 * Each editable field submits on its own rather than as part of a record-wide form. An operator
 * correcting a display name should not have to resubmit aliases and sensitivity alongside it,
 * and the audit trail is per-field: a single record form would either write one event per field
 * anyway or write one event saying "several things changed", and a reviewer reading the log
 * needs neither.
 *
 * The disabled state carries a reason. A save button that is dead with no explanation is the
 * most common way an operator surface wastes someone's afternoon — here the precondition ("give
 * a reason for this change first") is rendered next to the control that is waiting on it, and it
 * is wired to the button through `aria-describedby` so it is not sighted-only.
 *
 * Presentational by design: it knows about pending and result states, not about how the write
 * happens. The caller supplies the action and owns the transport.
 */

'use client';

import React, { useId, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type InlineEditStatus = 'idle' | 'saved' | 'error';

export type InlineEditProps = {
  /** The control(s) for this field — an input, a select, a fieldset of checkboxes. */
  readonly children: ReactNode;
  /** Form action. Accepts a server action or a URL, matching `<form action>`. */
  readonly action?: ComponentProps<'form'>['action'];
  readonly method?: 'get' | 'post';
  /** Emitted as hidden inputs — entity id, field name, the shared reason. */
  readonly hiddenFields?: Readonly<Record<string, string>>;
  readonly submitLabel?: string;
  readonly pending?: boolean;
  readonly pendingLabel?: string;
  readonly disabled?: boolean;
  /** Why the control is disabled. Shown next to it and announced with it. */
  readonly disabledReason?: string;
  readonly status?: InlineEditStatus;
  readonly message?: string;
  /** Extra controls beside Save — a reset, a "clear this field". */
  readonly actions?: ReactNode;
  readonly className?: string;
};

export function InlineEdit({
  children,
  action,
  method,
  hiddenFields,
  submitLabel = 'Save',
  pending = false,
  pendingLabel = 'Saving…',
  disabled = false,
  disabledReason,
  status = 'idle',
  message,
  actions,
  className,
}: InlineEditProps) {
  const reasonId = useId();
  const blocked = disabled || pending;
  const showReason = disabled && Boolean(disabledReason);

  return (
    <form
      className={cx('ds-inline-edit', className)}
      {...(action ? { action } : {})}
      {...(method ? { method } : {})}
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="ds-inline-edit__control">{children}</div>

      <div className="ds-inline-edit__actions">
        <button
          type="submit"
          className="ds-button ds-button--secondary ds-inline-edit__submit"
          disabled={blocked}
          {...(showReason ? { 'aria-describedby': reasonId } : {})}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {actions}

        {showReason ? (
          <span className="ds-inline-edit__hint" id={reasonId}>
            {disabledReason}
          </span>
        ) : null}

        {/* Success is polite and failure is assertive: a save that worked should not interrupt
            an operator already typing the next field, but one that failed must. */}
        {status === 'saved' && message ? (
          <span className="ds-inline-edit__ok" role="status">
            {message}
          </span>
        ) : null}
        {status === 'error' && message ? (
          <span className="ds-inline-edit__error" role="alert">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
