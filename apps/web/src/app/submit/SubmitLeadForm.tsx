'use client';

/**
 * The public "submit a lead" form. Posts to `./api/route.ts`, which is the only place this lane
 * ever writes into quarantine, create-only. Nothing submitted here is ever public: it enters a
 * moderated queue and only advances via independent-reviewer consensus
 * (`packages/domain/src/consensus-review/`) and, after that, the standard research pipeline.
 *
 * Checked as the reader goes (`lead-form.ts`); the server still decides. On success the form is
 * replaced by the receipt; on failure everything typed stays in place.
 */
import React, { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, buttonClassName } from '@repo/ui';
import { Field, fieldControlProps } from '../../components/room';
import { FormFailure, RequiredMark, RequiredNote, SubmitRow } from '../../components/forms/FormKit';
import { useFieldErrors } from '../../components/forms/use-field-errors';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';
import { leadIssueField, validateLeadForm } from './lead-form';

void React;

const LEAD_FIELDS = new Set(['url', 'description', 'whyItMatters', 'location', 'era', 'contact']);

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly submissionId: string | undefined }
  | { readonly status: 'failed'; readonly title: string; readonly detail: string };

export function SubmitLeadForm({ contact }: { readonly contact: string }) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const fields = useFieldErrors(validateLeadForm);
  const formRef = useRef<HTMLFormElement | null>(null);
  const doneRef = useRef<HTMLDivElement | null>(null);
  const failureRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const ids = {
    url: `${id}-url`,
    description: `${id}-description`,
    why: `${id}-why`,
    location: `${id}-location`,
    era: `${id}-era`,
    contact: `${id}-contact`,
    attestation: `${id}-attestation`,
  };

  useEffect(() => {
    if (state.status === 'success') doneRef.current?.focus();
    if (state.status === 'failed') failureRef.current?.focus();
  }, [state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!fields.validateAll(form)) return;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const payload = {
      url: text('url') || undefined,
      description: text('description') || undefined,
      whyItMatters: text('whyItMatters'),
      location: text('location') || undefined,
      era: text('era') || undefined,
      attestation: data.get('attestation') === 'on',
      contact: text('contact') || undefined,
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
            : undefined;
        setState({ status: 'success', submissionId });
        return;
      }
      if (response.status === 429) {
        setState({
          status: 'failed',
          title: 'Too many leads from this connection just now.',
          detail: 'Wait a few minutes, then send it again. Nothing you typed has been lost.',
        });
        return;
      }
      if (response.status === 400 && body && typeof body === 'object' && 'issues' in body) {
        const issues = (
          (body as { issues?: readonly { field: string; message: string }[] }).issues ?? []
        ).map((issue) => ({ ...issue, field: leadIssueField(issue.field) }));
        const onFields = issues.filter((issue) => LEAD_FIELDS.has(issue.field));
        const elsewhere = issues.filter((issue) => !LEAD_FIELDS.has(issue.field));
        fields.showIssues(formRef.current, onFields);
        setState(
          elsewhere.length === 0
            ? { status: 'idle' }
            : {
                status: 'failed',
                title: 'The lead wasn’t accepted.',
                detail: elsewhere.map((issue) => issue.message).join(' '),
              },
        );
        return;
      }
      throw new Error(`lead intake answered ${response.status}`);
    } catch {
      setState({
        status: 'failed',
        title: 'The lead wasn’t sent.',
        detail: `Nothing you typed has been lost. Try again in a moment, or email it to ${contact}.`,
      });
    }
  }

  function another() {
    fields.reset();
    setState({ status: 'idle' });
  }

  if (state.status === 'success') {
    return (
      <div className="ds-form-done" ref={doneRef} tabIndex={-1}>
        <h2 className="ds-form-done__title">Lead received.</h2>
        <p className="ds-form-done__body">
          It’s in the review queue, not on the site. If it’s worth pursuing it becomes a private
          research candidate, and nothing about it is published until it clears the same checks as
          every record.
        </p>
        {state.submissionId ? (
          <p className="ds-form-done__ref">
            Reference
            <code>{state.submissionId}</code>
          </p>
        ) : null}
        <div className="ds-form-done__actions">
          <Button variant="secondary" onClick={another}>
            Send another lead
          </Button>
          <a className={buttonClassName('quiet')} href="/archive">
            Browse the records
          </a>
        </div>
      </div>
    );
  }

  const error = (name: string) => fields.errors[name];
  const errorProps = (name: string) => (error(name) ? { error: error(name) } : {});

  return (
    <form
      className="ds-form"
      onSubmit={handleSubmit}
      onBlur={fields.onBlur}
      onChange={fields.onChange}
      ref={formRef}
      noValidate
      aria-busy={state.status === 'submitting' || undefined}
    >
      <RequiredNote />

      <fieldset className="ds-form-group">
        <legend>The lead</legend>
        <Field
          label={
            <>
              Link
              <RequiredMark />
            </>
          }
          htmlFor={ids.url}
          hint="Where this lives online, such as an article, an archived post or a group page."
          {...errorProps('url')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.url, hint: true, error: error('url') })}
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            placeholder="https://"
          />
        </Field>

        <Field
          label="What you know"
          htmlFor={ids.description}
          hint="Plain language is fine. Say where it comes from."
          {...errorProps('description')}
        >
          <textarea
            {...fieldControlProps({
              htmlFor: ids.description,
              hint: true,
              error: error('description'),
            })}
            name="description"
            rows={4}
          />
        </Field>

        <Field
          label={
            <>
              Why it matters
              <RequiredMark />
            </>
          }
          htmlFor={ids.why}
          hint="What would it help document?"
          {...errorProps('whyItMatters')}
        >
          <textarea
            {...fieldControlProps({ htmlFor: ids.why, hint: true, error: error('whyItMatters') })}
            name="whyItMatters"
            rows={3}
            required
            minLength={10}
          />
        </Field>

        <Field
          label="Where"
          htmlFor={ids.location}
          hint="A town, county or state, if you know it."
          {...errorProps('location')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.location, hint: true, error: error('location') })}
            name="location"
            type="text"
          />
        </Field>

        <Field
          label="When"
          htmlFor={ids.era}
          hint="A year or a decade is enough."
          {...errorProps('era')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.era, hint: true, error: error('era') })}
            name="era"
            type="text"
          />
        </Field>
      </fieldset>

      <fieldset className="ds-form-group">
        <legend>About you</legend>
        <Field
          label="Email"
          htmlFor={ids.contact}
          hint="Only for a question about this lead. Never shown publicly."
          {...errorProps('contact')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.contact, hint: true, error: error('contact') })}
            name="contact"
            type="email"
            autoComplete="email"
          />
        </Field>

        <div className="ds-form-check">
          <input id={ids.attestation} name="attestation" type="checkbox" />
          <label htmlFor={ids.attestation}>
            I believe this is accurate to the best of my knowledge.
            <small>Optional. Every lead is reviewed either way.</small>
          </label>
        </div>
      </fieldset>

      {state.status === 'failed' ? (
        <div ref={failureRef} tabIndex={-1}>
          <FormFailure title={state.title}>{state.detail}</FormFailure>
        </div>
      ) : null}

      <SubmitRow
        pending={state.status === 'submitting'}
        label="Send the lead"
        pendingLabel="Sending"
        note="Nothing you send is published as sent."
      />
    </form>
  );
}
