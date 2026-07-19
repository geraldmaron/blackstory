/**
 * Evidence attach — queue evidence against a research case (prepare or commit).
 */
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { EVIDENCE_ATTACH_INITIAL, submitEvidenceAttach } from './actions';

export default function EvidenceAttachPage() {
  const [state, formAction, isPending] = useActionState(
    submitEvidenceAttach,
    EVIDENCE_ATTACH_INITIAL,
  );

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Intake</p>
      <h1 className="ds-page__title">Attach evidence</h1>
      <p className="ds-page__lede">
        Propose evidence against a research case. Commit writes to quarantine only — checklist
        application remains a separate research action.
      </p>

      <form action={formAction} className="quick-add-form">
        <div className="quick-add-field">
          <label htmlFor="ev-case">Research case id</label>
          <input id="ev-case" name="researchCaseId" type="text" required />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-url">Source URL</label>
          <input id="ev-url" name="sourceUrl" type="url" required />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-desc">Description</label>
          <textarea id="ev-desc" name="description" rows={4} required />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-op">Operator id</label>
          <input id="ev-op" name="operatorId" type="text" required />
        </div>
        <div className="quick-add-field">
          <label htmlFor="ev-commit">
            <input id="ev-commit" name="commit" type="checkbox" value="1" /> Commit to quarantine
          </label>
        </div>
        <button className="ds-button ds-button--primary" type="submit" disabled={isPending}>
          {isPending ? 'Working…' : 'Prepare evidence proposal'}
        </button>
      </form>

      {state.status === 'error' ? (
        <p className="acq__alert" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.status === 'prepared' ? (
        <p className="acq__notice" role="status">
          Prepared submission {state.submissionId} for case{' '}
          <Link href={`/cases/${state.researchCaseId}`}>{state.researchCaseId}</Link>. Nothing
          written yet.
        </p>
      ) : null}
      {state.status === 'committed' ? (
        <p className="acq__notice" role="status">
          Committed submission {state.submissionId}. Audit {state.auditEventId}. Open{' '}
          <Link href={`/cases/${state.researchCaseId}`}>the case</Link>.
        </p>
      ) : null}
    </main>
  );
}
