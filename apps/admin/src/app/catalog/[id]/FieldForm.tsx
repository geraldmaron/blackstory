'use client';

/**
 * One inline field edit: its inputs, the shared reason, and the result of the last save.
 *
 * Each field is its own form rather than one big record form. An operator correcting a display
 * name should not have to resubmit aliases and sensitivity along with it, and the audit event is
 * per-field — a single form would either write one event per field or one event that says
 * "several things changed", and neither is what a reviewer reading the log needs.
 */
import { useActionState } from 'react';
import { saveEntityField } from './actions';
import { ENTITY_EDIT_INITIAL, type EntityEditState } from './edit-state';

export function FieldForm({
  entityId,
  field,
  reason,
  submitLabel = 'Save',
  disabled = false,
  children,
}: {
  readonly entityId: string;
  readonly field: string;
  readonly reason: string;
  readonly submitLabel?: string;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<EntityEditState, FormData>(
    saveEntityField,
    ENTITY_EDIT_INITIAL,
  );

  return (
    <form action={formAction} className="entity-edit__form">
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="reason" value={reason} />
      {children}
      <div className="entity-edit__actions">
        <button
          type="submit"
          className="ds-button ds-button--secondary"
          disabled={pending || disabled}
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {state.status === 'saved' ? (
          <span className="entity-edit__ok ds-mono" role="status">
            {state.message}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span className="entity-edit__error" role="alert">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
