'use client';

/**
 * The public "submit a lead" form. Posts to `./api/route.ts`, which is the only place
 * this lane ever writes into quarantine, create-only. Nothing submitted here is ever
 * public: it enters a moderated queue and only advances via independent-reviewer consensus
 * (`packages/domain/src/consensus-review/`) and, after that, the standard research
 * pipeline.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, Notice } from '@repo/ui';
import { Field, fieldControlProps } from '../../components/room';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly submissionId: string }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldIssues?: readonly { field: string; message: string }[];
    };

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
      const integrityHeaders = await getRequestIntegrityHeaders();
      const response = await fetch('/submit/api', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...integrityHeaders },
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

  const successRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (state.status === 'success') {
      successRef.current?.focus();
      return;
    }
    if (state.status !== 'error') return;
    /* Submit-wide: only the form knows which field failed first in reading order. */
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  if (state.status === 'success') {
    return (
      /*
       * Success, not a warning: `tone="warning"` announced this as an alert and coloured a
       * receipt like a problem. The panel also replaces the whole form, so focus moves to it
       * for the same reason the correction receipt does.
       */
      <div ref={successRef} tabIndex={-1}>
        <Notice tone="success" title="Lead received">
          Thank you. This lead (reference <code>{state.submissionId}</code>) has entered a review
          queue. It&apos;s not public, and it seeds research only if I judge it worth pursuing.
          Nobody but the people doing that review sees what you sent.
        </Notice>
      </div>
    );
  }

  const fieldIssue = (field: string) =>
    state.status === 'error'
      ? state.fieldIssues?.find((issue) => issue.field === field)
      : undefined;

  return (
    <form className="ds-stack" onSubmit={handleSubmit} ref={formRef} noValidate>
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

      <Field
        label="Link (article, archived post, group page, or anywhere this lives online)"
        htmlFor={urlId}
        {...(fieldIssue('url') ? { error: fieldIssue('url')!.message } : {})}
      >
        <input
          {...fieldControlProps({ htmlFor: urlId, error: fieldIssue('url') })}
          name="url"
          type="url"
          placeholder="https://…"
        />
      </Field>

      <Field
        label="Description (for something you know firsthand, or anything with no single link)"
        htmlFor={descriptionId}
        {...(fieldIssue('description') ? { error: fieldIssue('description')!.message } : {})}
      >
        <textarea
          {...fieldControlProps({ htmlFor: descriptionId, error: fieldIssue('description') })}
          name="description"
          rows={4}
          placeholder="What is this lead? Where does it come from?"
        />
      </Field>

      <Field
        label={
          <>
            Why it matters <span aria-hidden="true">*</span>
            <span className="ds-visually-hidden">required</span>
          </>
        }
        htmlFor={whyId}
        {...(fieldIssue('whyItMatters') ? { error: fieldIssue('whyItMatters')!.message } : {})}
      >
        <textarea
          {...fieldControlProps({ htmlFor: whyId, error: fieldIssue('whyItMatters') })}
          name="whyItMatters"
          rows={3}
          required
          minLength={10}
          placeholder="Why should this be researched? What would it help document?"
        />
      </Field>

      <div className="ds-room-field-pair">
        <Field
          label="Location (optional)"
          htmlFor={locationId}
          {...(fieldIssue('location') ? { error: fieldIssue('location')!.message } : {})}
        >
          <input
            {...fieldControlProps({ htmlFor: locationId, error: fieldIssue('location') })}
            name="location"
            type="text"
          />
        </Field>
        <Field
          label="Era (optional)"
          htmlFor={eraId}
          {...(fieldIssue('era') ? { error: fieldIssue('era')!.message } : {})}
        >
          <input
            {...fieldControlProps({ htmlFor: eraId, error: fieldIssue('era') })}
            name="era"
            type="text"
          />
        </Field>
      </div>

      <Field
        label="Contact (optional, reaches the reviewers only, never shown publicly)"
        htmlFor={contactId}
        {...(fieldIssue('contact') ? { error: fieldIssue('contact')!.message } : {})}
      >
        <input
          {...fieldControlProps({ htmlFor: contactId, error: fieldIssue('contact') })}
          name="contact"
          type="email"
        />
      </Field>

      <div className="ds-row" style={{ alignItems: 'flex-start' }}>
        <input id={attestationId} name="attestation" type="checkbox" />
        <label
          htmlFor={attestationId}
          className="ds-sans"
          style={{ marginLeft: 'var(--ds-space-2)' }}
        >
          I believe this information is accurate to the best of my knowledge (optional attestation;
          leads are reviewed either way).
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
