'use client';

/**
 * Evidence attach form — prepare or commit a source proposal against a research case.
 */
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import { EVIDENCE_ATTACH_INITIAL, submitEvidenceAttach } from './actions';
import { EVIDENCE_ATTACH_STEPS, evidenceSubmitLabel } from './evidence-intake-copy';

export function EvidenceAttachForm() {
  const { user } = useAdminAuth();
  const [commit, setCommit] = useState(false);
  const [operatorId, setOperatorId] = useState('');
  const [state, formAction, isPending] = useActionState(
    submitEvidenceAttach,
    EVIDENCE_ATTACH_INITIAL,
  );

  useEffect(() => {
    if (user?.email && !operatorId) {
      setOperatorId(user.email);
    }
  }, [user?.email, operatorId]);

  return (
    <>
      <ol className="acq__steps" aria-label="How to attach evidence">
        {EVIDENCE_ATTACH_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <form action={formAction} className="quick-add-form">
        <div className="quick-add-field">
          <label htmlFor="ev-case">Research case id</label>
          <input id="ev-case" name="researchCaseId" type="text" required autoComplete="off" />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-url">Source URL</label>
          <input id="ev-url" name="sourceUrl" type="url" required placeholder="https://…" />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-desc">Description</label>
          <textarea
            id="ev-desc"
            name="description"
            rows={4}
            required
            placeholder="What this source supports and why it matters for the case"
          />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-op">Operator id</label>
          <input
            id="ev-op"
            name="operatorId"
            type="text"
            required
            autoComplete="off"
            value={operatorId}
            onChange={(event) => setOperatorId(event.target.value)}
          />
          <p className="acq-sheet__meta">
            Stamped on the proposal for audit. Pre-filled from your sign-in when available.
          </p>
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-commit">
            <input
              id="ev-commit"
              name="commit"
              type="checkbox"
              value="1"
              checked={commit}
              onChange={(event) => setCommit(event.target.checked)}
            />{' '}
            Commit to quarantine (writes submission; does not publish)
          </label>
        </div>
        <button className="ds-button ds-button--primary" type="submit" disabled={isPending}>
          {evidenceSubmitLabel(commit, isPending)}
        </button>
      </form>

      {state.status === 'error' ? (
        <div className="ds-notice ds-notice--error" role="alert">
          <span className="ds-notice__cue" aria-hidden="true">
            Error
          </span>
          <div>
            <p className="ds-notice__title">{state.error}</p>
          </div>
        </div>
      ) : null}
      {state.status === 'prepared' ? (
        <div className="ds-notice" role="status">
          <span className="ds-notice__cue" aria-hidden="true">
            Prepared
          </span>
          <div>
            <p className="ds-notice__title">Evidence proposal prepared — nothing written yet.</p>
            <div className="ds-notice__body">
              <p>
                Submission <code>{state.submissionId}</code> for case{' '}
                <Link href={`/cases/${state.researchCaseId}`}>{state.researchCaseId}</Link>.
              </p>
              <p>
                Check commit and submit again to persist, or <Link href="/inbox">open inbox</Link>{' '}
                to continue triage.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {state.status === 'committed' ? (
        <div className="ds-notice" role="status">
          <span className="ds-notice__cue" aria-hidden="true">
            Committed
          </span>
          <div>
            <p className="ds-notice__title">Evidence written to quarantine.</p>
            <div className="ds-notice__body">
              <p>
                Submission <code>{state.submissionId}</code>. Audit event{' '}
                <code>{state.auditEventId}</code>. Nothing was published.
              </p>
              <p>
                <Link href={`/cases/${state.researchCaseId}`}>Open case</Link>
                {' · '}
                <Link href="/inbox">Open inbox</Link>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
