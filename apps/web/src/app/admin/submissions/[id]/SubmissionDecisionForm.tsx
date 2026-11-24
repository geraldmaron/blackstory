'use client';

/**
 * The three decision verbs for one quarantined submission: promote, reject, mark spam.
 * One shared reason, one shared server action — see actions.ts's decideSubmission.
 */
import {
  ConfirmAction,
  type ConfirmActionRequest,
} from '../../../../admin/design-system/ConfirmAction';
import { FormTextarea, FormButton } from '../../../../admin/design-system/fields';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import type { SubmissionDecision } from '../../../../admin/lib/postgres-submissions';
import { decideSubmission } from './actions';
import { SUBMISSION_DECISION_INITIAL, type SubmissionDecisionState } from './decision-state';

const DECISION_LABEL = {
  promote: 'Promote to research case',
  reject: 'Reject',
  spam: 'Mark spam',
  resolve: 'Close as resolved',
} as const;

/**
 * The decisions staff cannot take back: none of them leaves a status with a further decision
 * (`submissionDecisionOptions`), and reject and resolve can email the submitter. Promote is left
 * at one click: the research case it opens can still be excluded.
 */
const CONFIRMED: Partial<
  Record<SubmissionDecision, Pick<ConfirmActionRequest, 'verb' | 'tail'> & { closed: string }>
> = {
  reject: { verb: 'Reject', closed: 'a rejected submission' },
  spam: { verb: 'Mark', tail: 'as spam', closed: 'a submission marked as spam' },
  resolve: { verb: 'Close', tail: 'as resolved', closed: 'a correction closed as resolved' },
};

export function SubmissionDecisionForm({
  intakeItemId,
  title,
  emailsSubmitter = false,
  decisions,
  needsPublicReason = false,
}: {
  readonly intakeItemId: string;
  /** The submission's own title: the confirmation names what is being closed. */
  readonly title: string;
  /** Rejecting or resolving this one emails its submitter. Marking spam never does. */
  readonly emailsSubmitter?: boolean;
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
  // Which verb was pressed, so only that button reads "Working…" while the action runs.
  const [pressed, setPressed] = useState<SubmissionDecision | null>(null);
  const [confirming, setConfirming] = useState<ConfirmActionRequest | null>(null);
  const hintId = useId();
  const doneRef = useRef<HTMLDivElement>(null);
  const canSubmit = reason.trim().length > 0 && !pending;
  const blocked = (decision: SubmissionDecision) =>
    !canSubmit || (decision === 'reject' && needsPublicReason && !publicReason.trim());
  // Why a button is disabled, in visible text the button points at (the kit's InlineEdit pattern).
  const hint = !reason.trim()
    ? 'Enter a reason to enable these actions.'
    : needsPublicReason && !publicReason.trim() && decisions.includes('reject')
      ? 'Reject also needs the reason the submitter sees.'
      : null;

  // The form unmounts on success; without this, focus falls to <body>.
  useEffect(() => {
    if (state.status === 'decided') doneRef.current?.focus();
  }, [state.status]);

  if (state.status === 'decided') {
    return (
      <div className="ds-notice" role="status" tabIndex={-1} ref={doneRef}>
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

  function askFirst(decision: SubmissionDecision, button: HTMLButtonElement) {
    const copy = CONFIRMED[decision];
    if (!copy) return false;
    const emailed = emailsSubmitter && decision !== 'spam';
    setConfirming({
      verb: copy.verb,
      ...(copy.tail ? { tail: copy.tail } : {}),
      noun: 'submission',
      name: title,
      consequence: `You can’t reopen ${copy.closed}, and the submitter ${
        emailed ? 'will be emailed the outcome' : 'will not be emailed'
      }.`,
      trigger: button,
      // The same submit the button would have made: same form, same submitter, same action.
      onConfirm: () => button.form?.requestSubmit(button),
    });
    return true;
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
            {...(hint && !pending && blocked(decision) ? { 'aria-describedby': hintId } : {})}
            onClick={(event) => {
              setPressed(decision);
              if (askFirst(decision, event.currentTarget)) event.preventDefault();
            }}
          >
            {pending && pressed === decision ? 'Working…' : DECISION_LABEL[decision]}
          </FormButton>
        ))}
        {hint ? (
          <span className="entity-edit__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </div>
      <ConfirmAction request={confirming} onDismiss={() => setConfirming(null)} />
    </form>
  );
}
