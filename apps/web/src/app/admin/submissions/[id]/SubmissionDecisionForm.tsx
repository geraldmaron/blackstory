'use client';

/**
 * The three decision verbs for one quarantined submission: promote, reject, mark spam.
 * One shared reason, one shared server action — see actions.ts's decideSubmission.
 */
import { FormTextarea, FormButton } from '../../../../admin/design-system/fields';
import { useActionState, useState } from 'react';
import type { SubmissionDecision } from '../../../../admin/lib/postgres-submissions';
import { decideSubmission } from './actions';
import { SUBMISSION_DECISION_INITIAL, type SubmissionDecisionState } from './decision-state';

const DECISION_LABEL = {
  promote: 'Promote to research case',
  reject: 'Reject',
  spam: 'Mark spam',
  resolve: 'Close as resolved',
} as const;

export function SubmissionDecisionForm({
  intakeItemId,
  decisions,
  needsPublicReason = false,
}: {
  readonly intakeItemId: string;
  readonly decisions: readonly SubmissionDecision[];
  /** A correction with a receipt: declining it needs a reason its submitter will read. */
  readonly needsPublicReason?: boolean;
}) {
  const [state, formAction, pending] = useActionState<SubmissionDecisionState, FormData>(
    decideSubmission,
    SUBMISSION_DECISION_INITIAL,
  );
  const [reason, setReason] = useState('');
  const [publicReason, setPublicReason] = useState('');
  const canSubmit = reason.trim().length > 0 && !pending;
  const blocked = (decision: SubmissionDecision) =>
    !canSubmit || (decision === 'reject' && needsPublicReason && !publicReason.trim());

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
        <FormTextarea
          name="reason"
          rows={2}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Cite what you checked and the resulting record change."
        />
      </label>
      {needsPublicReason ? (
        <label>
          <span>Reason the submitter sees (needed to reject)</span>
          <FormTextarea
            name="publicReason"
            rows={3}
            maxLength={1000}
            value={publicReason}
            onChange={(event) => setPublicReason(event.target.value)}
            placeholder="Shown on their receipt page and in the email. Plain language, written to them. No street addresses or internal notes."
          />
        </label>
      ) : null}
      <div className="entity-edit__actions">
        {decisions.map((decision, index) => (
          <FormButton
            key={decision}
            type="submit"
            name="decision"
            value={decision}
            className={index === 0 ? 'ds-button' : 'ds-button ds-button--secondary'}
            disabled={blocked(decision)}
          >
            {pending ? 'Working…' : DECISION_LABEL[decision]}
          </FormButton>
        ))}
      </div>
    </form>
  );
}
