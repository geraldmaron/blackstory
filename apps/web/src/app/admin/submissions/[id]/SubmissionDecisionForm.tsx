'use client';

/**
 * The three decision verbs for one quarantined submission: promote, reject, mark spam.
 * One shared reason, one shared server action — see actions.ts's decideSubmission.
 */
import { useActionState, useState } from 'react';
import { decideSubmission } from './actions';
import { SUBMISSION_DECISION_INITIAL, type SubmissionDecisionState } from './decision-state';

const DECISION_LABEL = {
  promote: 'Promote to research case',
  reject: 'Reject',
  spam: 'Mark spam',
} as const;

export function SubmissionDecisionForm({ intakeItemId }: { readonly intakeItemId: string }) {
  const [state, formAction, pending] = useActionState<SubmissionDecisionState, FormData>(
    decideSubmission,
    SUBMISSION_DECISION_INITIAL,
  );
  const [reason, setReason] = useState('');
  const canSubmit = reason.trim().length > 0 && !pending;

  if (state.status === 'decided') {
    return (
      <div className="ds-notice" role="status">
        <span className="ds-notice__cue" aria-hidden="true">
          Decided
        </span>
        <div>
          <p className="ds-notice__title">{state.message}</p>
          <p className="ds-notice__body">
            Audit event <code>{state.eventId}</code>.
            {state.researchCaseId ? (
              <>
                {' '}
                <a href={`/admin/cases/${state.researchCaseId}`}>Open the case</a>.
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="entity-edit__form">
      <input type="hidden" name="intakeItemId" value={intakeItemId} />
      {state.status === 'error' ? (
        <p className="ds-notice ds-notice--error" role="alert">
          {state.message}
        </p>
      ) : null}
      <label>
        <span>Reason</span>
        <textarea
          name="reason"
          rows={2}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this decision — cite what you checked."
        />
      </label>
      <div className="entity-edit__actions">
        <button
          type="submit"
          name="decision"
          value="promote"
          className="ds-button"
          disabled={!canSubmit}
        >
          {pending ? 'Working…' : DECISION_LABEL.promote}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          className="ds-button ds-button--secondary"
          disabled={!canSubmit}
        >
          {pending ? 'Working…' : DECISION_LABEL.reject}
        </button>
        <button
          type="submit"
          name="decision"
          value="spam"
          className="ds-button ds-button--secondary"
          disabled={!canSubmit}
        >
          {pending ? 'Working…' : DECISION_LABEL.spam}
        </button>
      </div>
    </form>
  );
}
