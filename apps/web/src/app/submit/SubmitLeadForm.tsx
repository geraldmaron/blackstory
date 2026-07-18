'use client';

/**
 * The public "submit a lead" form. Posts to `./api/route.ts`, which is the only place
 * this lane ever writes into quarantine, create-only. Nothing submitted here is ever
 * public: it enters a moderated queue and only advances via independent-reviewer consensus
 * (`packages/domain/src/consensus-review/`) and, after that, the standard research
 * pipeline.
 */
import { useId, useState, type FormEvent } from 'react';
import { Button, Notice } from '@blap/ui';
import { getSubmitLeadAppCheckHeaders } from './app-check-client';

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly submissionId: string }
  | { readonly status: 'error'; readonly message: string; readonly fieldIssues?: readonly { field: string; message: string }[] };

const DEFAULT_ERROR_MESSAGE =
  'Something went wrong submitting this lead. Please try again in a moment.';

export function SubmitLeadForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const urlId = useId();
  const descriptionId = useId();
  const whyId = useId();
  const locationId = useId();
  const eraId = useId();
  const attestationId = useId();
  const contactId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      url: String(data.get('url') ?? '').trim() || undefined,
      description: String(data.get('description') ?? '').trim() || undefined,
      whyItMatters: String(data.get('whyItMatters') ?? '').trim(),
      location: String(data.get('location') ?? '').trim() || undefined,
      era: String(data.get('era') ?? '').trim() || undefined,
      attestation: data.get('attestation') === 'on',
      contact: String(data.get('contact') ?? '').trim() || undefined,
    };

    setState({ status: 'submitting' });
    try {
      const appCheckHeaders = await getSubmitLeadAppCheckHeaders();
      const response = await fetch('/submit/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status === 202) {
        const submissionId =
          body && typeof body === 'object' && 'submissionId' in body
            ? String((body as { submissionId: unknown }).submissionId)
            : 'unknown';
        setState({ status: 'success', submissionId });
        form.reset();
        return;
      }

      if (response.status === 429) {
        setState({
          status: 'error',
          message: 'Too many submissions from this connection. Please try again shortly.',
        });
        return;
      }

      if (response.status === 400 && body && typeof body === 'object' && 'issues' in body) {
        const issues = (body as { issues?: readonly { field: string; message: string }[] }).issues;
        setState({
          status: 'error',
          message: 'Please fix the highlighted fields and resubmit.',
          ...(issues ? { fieldIssues: issues } : {}),
        });
        return;
      }

      setState({ status: 'error', message: DEFAULT_ERROR_MESSAGE });
    } catch {
      setState({ status: 'error', message: DEFAULT_ERROR_MESSAGE });
    }
  }

  if (state.status === 'success') {
    return (
      <Notice tone="warning" title="Lead received">
        Thank you — this lead (reference <code>{state.submissionId}</code>) has entered a
        moderated review queue. It is not public, and it will only ever seed research after
        independent reviewers agree it is worth pursuing. Nothing you submitted is visible to
        anyone but the moderation team.
      </Notice>
    );
  }

  const fieldIssue = (field: string) =>
    state.status === 'error' ? state.fieldIssues?.find((issue) => issue.field === field) : undefined;

  return (
    <form className="bp-stack" onSubmit={handleSubmit} noValidate>
      {state.status === 'error' && !state.fieldIssues ? (
        <Notice tone="error" title="Submission failed">
          {state.message}
        </Notice>
      ) : null}
      {state.status === 'error' && state.fieldIssues ? (
        <Notice tone="error" title="Check the following">
          <ul>
            {state.fieldIssues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
        <label className="bp-filters__label" htmlFor={urlId}>
          Link (article, archived post, group page, or anywhere this lives online)
        </label>
        <input
          className="bp-filters__control"
          id={urlId}
          name="url"
          type="url"
          placeholder="https://…"
          aria-describedby={fieldIssue('url') ? `${urlId}-issue` : undefined}
        />
        {fieldIssue('url') ? (
          <p id={`${urlId}-issue`} className="bp-sans" role="alert">
            {fieldIssue('url')!.message}
          </p>
        ) : null}
      </div>

      <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
        <label className="bp-filters__label" htmlFor={descriptionId}>
          Description (if there is no single link — e.g. something you know firsthand)
        </label>
        <textarea
          className="bp-filters__control"
          id={descriptionId}
          name="description"
          rows={4}
          placeholder="What is this lead? Where does it come from?"
        />
      </div>

      <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
        <label className="bp-filters__label" htmlFor={whyId}>
          Why it matters <span aria-hidden="true">*</span>
          <span className="bp-visually-hidden">required</span>
        </label>
        <textarea
          className="bp-filters__control"
          id={whyId}
          name="whyItMatters"
          rows={3}
          required
          minLength={10}
          placeholder="Why should this be researched? What would it help document?"
          aria-describedby={fieldIssue('whyItMatters') ? `${whyId}-issue` : undefined}
        />
        {fieldIssue('whyItMatters') ? (
          <p id={`${whyId}-issue`} className="bp-sans" role="alert">
            {fieldIssue('whyItMatters')!.message}
          </p>
        ) : null}
      </div>

      <div className="bp-row">
        <div className="bp-stack" style={{ gap: 'var(--bp-space-2)', flex: '1 1 12rem' }}>
          <label className="bp-filters__label" htmlFor={locationId}>
            Location (optional)
          </label>
          <input className="bp-filters__control" id={locationId} name="location" type="text" />
        </div>
        <div className="bp-stack" style={{ gap: 'var(--bp-space-2)', flex: '1 1 12rem' }}>
          <label className="bp-filters__label" htmlFor={eraId}>
            Era (optional)
          </label>
          <input className="bp-filters__control" id={eraId} name="era" type="text" />
        </div>
      </div>

      <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
        <label className="bp-filters__label" htmlFor={contactId}>
          Contact (optional — only reachable by moderators, never shown publicly)
        </label>
        <input className="bp-filters__control" id={contactId} name="contact" type="text" />
      </div>

      <div className="bp-row" style={{ alignItems: 'flex-start' }}>
        <input id={attestationId} name="attestation" type="checkbox" />
        <label htmlFor={attestationId} className="bp-sans" style={{ marginLeft: 'var(--bp-space-2)' }}>
          I believe this information is accurate to the best of my knowledge (optional
          attestation — leads are reviewed either way).
        </label>
      </div>

      <div>
        <Button type="submit" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Submitting…' : 'Submit lead'}
        </Button>
      </div>
    </form>
  );
}
