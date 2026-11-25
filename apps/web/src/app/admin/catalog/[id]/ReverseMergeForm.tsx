'use client';

/**
 * Undo one merge. Its own reason field: reversing is a decision in its own right, and the log
 * should say why the earlier one was wrong rather than reusing the reason that justified it.
 */
import { FormInput, FormButton } from '../../../../admin/design-system/fields';
import { useActionState, useId, useState } from 'react';
import { reverseMerge } from '../merge/actions';
import { MERGE_INITIAL } from '../merge/merge-state';

export function ReverseMergeForm({ mergeId }: { readonly mergeId: string }) {
  const [state, formAction, pending] = useActionState(reverseMerge, MERGE_INITIAL);
  const [reason, setReason] = useState('');
  const hintId = useId();
  const needsReason = !reason.trim();

  return (
    <form action={formAction} className="entity-edit__form">
      <input type="hidden" name="mergeId" value={mergeId} />
      <label className="story-review__field">
        <span>Reason for reversing</span>
        <FormInput
          type="text"
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why were these not the same record?"
          required
        />
      </label>
      <div className="entity-edit__actions">
        <FormButton
          type="submit"
          className="ds-button ds-button--secondary"
          disabled={pending || needsReason}
          {...(needsReason ? { 'aria-describedby': hintId } : {})}
        >
          {pending ? 'Reversing…' : 'Reverse this merge'}
        </FormButton>
        {needsReason ? (
          <span className="entity-edit__hint" id={hintId}>
            Enter a reason to enable the reversal.
          </span>
        ) : null}
        {state.status === 'ok' ? (
          <span className="entity-edit__ok" role="status">
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
