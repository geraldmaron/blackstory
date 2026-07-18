'use client';

/**
 * Quick-add form: paste a URL, fetch it through safety, review the pre-filled
 * citation and capture-plan note, and see the draft research case `runResearchIntake` prepared.
 * All the real work happens server-side in `./actions.ts`; this component only renders state.
 */
import { useActionState } from 'react';
import { submitQuickAdd } from './actions';
import { QUICK_ADD_INITIAL_STATE, type QuickAddFormState } from './form-state';

function ResultPanel({ state }: { readonly state: QuickAddFormState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'error') {
    return (
      <div className="bb-notice bb-notice--error" role="alert">
        <span className="bb-notice__cue" aria-hidden="true">
          Error
        </span>
        <div>
          <p className="bb-notice__title">{state.error}</p>
        </div>
      </div>
    );
  }

  const { outcome } = state;
  if (!outcome.fetch.ok) {
    return (
      <div className="bb-notice bb-notice--error" role="alert">
        <span className="bb-notice__cue" aria-hidden="true">
          Error
        </span>
        <div>
          <p className="bb-notice__title">BB-030 safe fetch refused this URL.</p>
          <div className="bb-notice__body">
            <p>
              Reason: <code>{outcome.fetch.reason}</code>. Nothing was proposed — no quarantine
              record or draft research case was created.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-add-result">
      {outcome.citation ? (
        <aside className="bb-citation" aria-label="Pre-filled citation">
          <span className="bb-citation__label">Pre-filled citation</span>
          <a href={outcome.citation.sourceUrl} rel="noopener noreferrer">
            {outcome.citation.suggestedTitle}
          </a>
          <p className="quick-add-excerpt">{outcome.citation.excerpt}</p>
          <p className="quick-add-meta">
            Fetched {outcome.citation.fetchedAt} · sha256 {outcome.citation.contentHash.slice(0, 12)}
            … · {outcome.citation.contentType}
          </p>
        </aside>
      ) : null}

      {outcome.capturePlan ? (
        <div className="bb-notice bb-notice--warning" role="status">
          <span className="bb-notice__cue" aria-hidden="true">
            Warning
          </span>
          <div>
            <p className="bb-notice__title">
              Archival capture point: {outcome.capturePlan.snapshotMode} snapshot, Wayback
              integration {outcome.capturePlan.waybackIntegration}
            </p>
            <div className="bb-notice__body">
              <p>{outcome.capturePlan.notes}</p>
            </div>
          </div>
        </div>
      ) : null}

      {outcome.intake ? (
        outcome.intake.accepted ? (
          <div className="quick-add-draft">
            <h2>Draft proposal prepared</h2>
            <dl>
              <div>
                <dt>Quarantine submission</dt>
                <dd className="bb-citation__label">{outcome.intake.submission.id}</dd>
              </div>
              <div>
                <dt>Moderation state</dt>
                <dd>{outcome.intake.submission.moderationState}</dd>
              </div>
              {outcome.intake.researchCase ? (
                <div>
                  <dt>Draft research case</dt>
                  <dd className="bb-citation__label">
                    {outcome.intake.researchCase.id} ({outcome.intake.researchCase.state})
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Proposed by</dt>
                <dd>
                  {outcome.intake.operator.operatorId} · session {state.sessionId}
                </dd>
              </div>
            </dl>
            <button
              className="bb-button bb-button--secondary"
              disabled
              title="Live commit wiring intentionally follows this console's existing pattern — not connected in this shell"
              type="button"
            >
              Commit to quarantine pipeline
            </button>
            <p className="quick-add-note">
              Nothing has been written yet. Commit this exact prepared proposal with{' '}
              <code>operator-cli submit-lead --commit</code> (or the equivalent package call)
              once reviewed — publishing still requires a separate, fresh-authenticated
              promotion action after that.
            </p>
          </div>
        ) : (
          <div className="bb-notice bb-notice--dispute" role="status">
            <span className="bb-notice__cue" aria-hidden="true">
              Disputed
            </span>
            <div>
              <p className="bb-notice__title">BB-029 validation rejected this proposal.</p>
              <div className="bb-notice__body">
                <ul>
                  {outcome.intake.rejection.issues.map((issue) => (
                    <li key={`${issue.field}-${issue.reason}`}>
                      {issue.field}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
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
          <label htmlFor="qa-description">Notes (optional — the fetched excerpt fills this in otherwise)</label>
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
          <p id="qa-operator-help" className="quick-add-note">
            Stamped onto the proposal and its audit event. A verified admin identity will
            replace this field once IAP/Firebase session verification is wired into this route.
          </p>
        </div>
        <button className="bb-button bb-button--primary" disabled={isPending} type="submit">
          {isPending ? 'Fetching…' : 'Fetch and prepare draft'}
        </button>
      </form>
      <ResultPanel state={state} />
    </>
  );
}
