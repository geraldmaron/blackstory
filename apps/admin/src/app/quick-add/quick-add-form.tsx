'use client';

/**
 * Quick-add form: paste a URL, fetch through safety, prepare a draft case, optionally commit.
 */
import Link from 'next/link';
import { useActionState } from 'react';
import { submitQuickAdd } from './actions';
import { QUICK_ADD_INITIAL_STATE, type QuickAddFormState } from './form-state';

function ResultPanel({ state }: { readonly state: QuickAddFormState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'error') {
    return (
      <div className="ds-notice ds-notice--error" role="alert">
        <span className="ds-notice__cue" aria-hidden="true">
          Error
        </span>
        <div>
          <p className="ds-notice__title">{state.error}</p>
        </div>
      </div>
    );
  }

  if (state.status === 'committed') {
    const caseId = state.researchCaseId;
    return (
      <div className="ds-notice" role="status">
        <span className="ds-notice__cue" aria-hidden="true">
          Committed
        </span>
        <div>
          <p className="ds-notice__title">Proposal written to quarantine.</p>
          <div className="ds-notice__body">
            <p>
              Audit event <code>{state.auditEventId}</code>. Nothing was published.
            </p>
            {caseId ? (
              <p>
                Open the draft case in{' '}
                <Link href={`/cases/${caseId}`}>Cases</Link> or continue from{' '}
                <Link href="/inbox">Inbox</Link>.
              </p>
            ) : (
              <p>
                Continue triage in <Link href="/inbox">Inbox</Link>.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { outcome } = state;
  if (!outcome.fetch.ok) {
    return (
      <div className="ds-notice ds-notice--error" role="alert">
        <span className="ds-notice__cue" aria-hidden="true">
          Error
        </span>
        <div>
          <p className="ds-notice__title">Safe-fetch refused this URL.</p>
          <div className="ds-notice__body">
            <p>
              Reason: <code>{outcome.fetch.reason}</code>. Nothing was proposed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-add-result">
      {outcome.citation ? (
        <aside className="ds-citation" aria-label="Pre-filled citation">
          <span className="ds-citation__label">Pre-filled citation</span>
          <a href={outcome.citation.sourceUrl} rel="noopener noreferrer">
            {outcome.citation.suggestedTitle}
          </a>
          <p className="quick-add-excerpt">{outcome.citation.excerpt}</p>
        </aside>
      ) : null}

      {outcome.intake ? (
        outcome.intake.accepted ? (
          <div className="quick-add-draft">
            <h2>Draft proposal prepared</h2>
            <dl>
              <div>
                <dt>Quarantine submission</dt>
                <dd className="ds-citation__label">{outcome.intake.submission.id}</dd>
              </div>
              {outcome.intake.researchCase ? (
                <div>
                  <dt>Draft research case</dt>
                  <dd className="ds-citation__label">
                    {outcome.intake.researchCase.id} ({outcome.intake.researchCase.state})
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="quick-add-note">
              Nothing was written yet. Check &quot;Commit to quarantine&quot; and submit again to
              persist, or use the prepare-only path for review first. Publishing remains a separate
              release action.
            </p>
          </div>
        ) : (
          <div className="ds-notice ds-notice--dispute" role="status">
            <span className="ds-notice__cue" aria-hidden="true">
              Rejected
            </span>
            <div>
              <p className="ds-notice__title">Intake validation rejected this proposal.</p>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

export function QuickAddForm() {
  const [state, formAction, isPending] = useActionState(submitQuickAdd, QUICK_ADD_INITIAL_STATE);

  return (
    <>
      <form action={formAction} className="quick-add-form">
        <div className="quick-add-field">
          <label htmlFor="qa-url">Source URL</label>
          <input id="qa-url" name="url" type="url" placeholder="https://…" required />
        </div>
        <div className="quick-add-field">
          <label htmlFor="qa-description">Notes (optional)</label>
          <textarea id="qa-description" name="description" rows={3} />
        </div>
        <div className="quick-add-row">
          <div className="quick-add-field">
            <label htmlFor="qa-location">Location</label>
            <input id="qa-location" name="location" type="text" />
          </div>
          <div className="quick-add-field">
            <label htmlFor="qa-era">Era</label>
            <input id="qa-era" name="era" type="text" />
          </div>
        </div>
        <div className="quick-add-field">
          <label htmlFor="qa-operator">Operator id</label>
          <input id="qa-operator" name="operatorId" type="text" required autoComplete="off" />
        </div>
        <div className="quick-add-field">
          <label htmlFor="qa-commit">
            <input id="qa-commit" name="commit" type="checkbox" value="1" /> Commit to quarantine
            pipeline (writes submission + draft research case; does not publish)
          </label>
        </div>
        <button className="ds-button ds-button--primary" disabled={isPending} type="submit">
          {isPending ? 'Working…' : 'Fetch and prepare draft'}
        </button>
      </form>
      <ResultPanel state={state} />
    </>
  );
}
