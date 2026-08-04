'use client';

/**
 * One inline field edit: its inputs, the shared reason, and the result of the last save.
 *
 * Each field is its own form rather than one big record form. An operator correcting a display
 * name should not have to resubmit aliases and sensitivity along with it, and the audit event is
 * per-field — a single form would either write one event per field or one event that says
 * "several things changed", and neither is what a reviewer reading the log needs.
 *
 * The shape lives in `@repo/ui`'s InlineEdit; what stays here is the transport — the server
 * action, the entity/field identity, and the audit reason carried alongside them.
 */
import { useActionState } from 'react';
import { InlineEdit } from '@repo/ui';
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
    <InlineEdit
      className="entity-edit__form"
      action={formAction}
      hiddenFields={{ entityId, field, reason }}
      submitLabel={submitLabel}
      pending={pending}
      disabled={disabled}
      // The button used to just go dead when no reason was typed, with the explanation sitting
      // in a paragraph at the top of the record — several fields away from what it was blocking.
      disabledReason="Give a reason for this change first."
      status={state.status === 'saved' ? 'saved' : state.status === 'error' ? 'error' : 'idle'}
      {...(state.status === 'saved' || state.status === 'error' ? { message: state.message } : {})}
    >
      {children}
    </InlineEdit>
  );
}
