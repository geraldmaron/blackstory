'use client';

/**
 * The two forms a receipt's status page carries: an appeal against a closed correction, and a
 * report of abusive correction activity. Same fields, same checks, same states as the other
 * public forms; they differ only in where they post, whether a link is required, and their words.
 * Neither ever exposes moderation-sensitive detail.
 */
import React, { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Field, fieldControlProps, fieldErrorId } from '../../components/forms/fields';
import { FormFailure, RequiredMark, RequiredNote, SubmitRow } from '../../components/forms/FormKit';
import { useFieldErrors, type FieldErrors } from '../../components/forms/use-field-errors';
import {
  EMAIL_MESSAGE,
  URL_MESSAGE,
  fieldText,
  isEmail,
  isHttpsUrl,
} from '../../components/forms/validators';
import { postJsonWithRequestIntegrity } from '../../lib/request-integrity/client';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import {
  MAX_CONTACT_LENGTH,
  MAX_STATEMENT_LENGTH,
  MIN_STATEMENT_LENGTH,
  tooLongMessage,
} from './correction-intake';

const STATEMENT_LIMIT_HINT = `Up to ${MAX_STATEMENT_LENGTH.toLocaleString('en-US')} characters.`;

void React;

export type FollowUpKind = 'appeal' | 'abuse';

const FOLLOW_UP_FIELDS = new Set(['statement', 'sourceUrl', 'contact', 'privacyConsent']);

const COPY = {
  appeal: {
    endpoint: '/corrections/appeal/api',
    statementLabel: 'Why should the outcome change?',
    statementHint: `Say what the review missed. Plain language is fine. ${STATEMENT_LIMIT_HINT}`,
    linkRequired: true,
    linkLabel: 'Where can it be checked?',
    send: 'Send the appeal',
    doneTitle: 'Appeal received.',
    doneBody:
      'It has re-entered review against the same receipt. This page shows any change in status.',
    variant: 'primary',
  },
  abuse: {
    endpoint: '/corrections/abuse/api',
    statementLabel: 'What happened?',
    statementHint: `Describe the activity. Leave out anyone’s private details. ${STATEMENT_LIMIT_HINT}`,
    linkRequired: false,
    linkLabel: 'A link that shows it',
    send: 'Send the report',
    doneTitle: 'Report received.',
    doneBody: 'Abuse reports are reviewed separately, and they never expose another submitter.',
    variant: 'secondary',
  },
} as const;

export function validateFollowUp(kind: FollowUpKind, data: FormData): FieldErrors {
  const errors: Record<string, string> = {};
  const statement = fieldText(data, 'statement');
  if (statement.length < MIN_STATEMENT_LENGTH) {
    errors.statement = `Say a little more. It needs at least ${MIN_STATEMENT_LENGTH} characters.`;
  } else if (statement.length > MAX_STATEMENT_LENGTH) {
    errors.statement = tooLongMessage('what you wrote', MAX_STATEMENT_LENGTH);
  }
  const link = fieldText(data, 'sourceUrl');
  if (link.length === 0 && COPY[kind].linkRequired) {
    errors.sourceUrl = 'Add a link to the record or the evidence the appeal rests on.';
  } else if (link.length > 0 && !isHttpsUrl(link)) {
    errors.sourceUrl = URL_MESSAGE;
  }
  const contact = fieldText(data, 'contact');
  if (contact.length > MAX_CONTACT_LENGTH) {
    errors.contact = tooLongMessage('the email address', MAX_CONTACT_LENGTH);
  } else if (contact.length > 0 && !isEmail(contact)) errors.contact = EMAIL_MESSAGE;
  if (data.get('privacyConsent') !== 'on') {
    errors.privacyConsent = 'Tick the box to confirm you have read how this is handled.';
  }
  return errors;
}

type State =
  | { readonly status: 'idle' | 'submitting' | 'success' }
  | { readonly status: 'failed'; readonly title: string; readonly detail: string };

export function ReceiptFollowUpForm({
  kind,
  receiptCode,
}: {
  readonly kind: FollowUpKind;
  readonly receiptCode: string;
}) {
  const copy = COPY[kind];
  const [state, setState] = useState<State>({ status: 'idle' });
  const validate = useMemo(() => (data: FormData) => validateFollowUp(kind, data), [kind]);
  const fields = useFieldErrors(validate);
  const formRef = useRef<HTMLFormElement | null>(null);
  const doneRef = useRef<HTMLDivElement | null>(null);
  const failureRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (state.status === 'success') doneRef.current?.focus();
    if (state.status === 'failed') failureRef.current?.focus();
  }, [state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!fields.validateAll(form)) return;
    const data = new FormData(form);
    const payload = {
      receiptCode,
      statement: fieldText(data, 'statement'),
      sourceUrl: fieldText(data, 'sourceUrl') || undefined,
      privacyConsent: data.get('privacyConsent') === 'on',
      contact: fieldText(data, 'contact') || undefined,
    };
    setState({ status: 'submitting' });
    try {
      const response = await postJsonWithRequestIntegrity(copy.endpoint, payload);
      const body: unknown = await response.json().catch(() => undefined);
      if (response.status === 202) {
        setState({ status: 'success' });
        return;
      }
      if (response.status === 429) {
        setState({
          status: 'failed',
          title: 'Too many messages from this connection just now.',
          detail: 'Wait a few minutes, then send it again. Nothing you typed has been lost.',
        });
        return;
      }
      if (kind === 'appeal' && [403, 404, 409].includes(response.status)) {
        setState({
          status: 'failed',
          title: 'This receipt can’t take an appeal right now.',
          detail: 'An appeal is open only once a correction is closed, and only once per receipt.',
        });
        return;
      }
      if (response.status === 400 && body && typeof body === 'object' && 'issues' in body) {
        // The server names the link field `sourceUrls`; an issue on a field this form does not
        // draw (the receipt code, the whole payload) has to surface as a form-level message.
        const issues = (
          (body as { issues?: readonly { field: string; message: string }[] }).issues ?? []
        ).map((issue) => (issue.field === 'sourceUrls' ? { ...issue, field: 'sourceUrl' } : issue));
        const elsewhere = issues.filter((issue) => !FOLLOW_UP_FIELDS.has(issue.field));
        fields.showIssues(
          formRef.current,
          issues.filter((issue) => FOLLOW_UP_FIELDS.has(issue.field)),
        );
        setState(
          elsewhere.length === 0
            ? { status: 'idle' }
            : {
                status: 'failed',
                title: 'It wasn’t accepted.',
                detail: elsewhere.map((issue) => issue.message).join(' '),
              },
        );
        return;
      }
      throw new Error(`follow-up intake answered ${response.status}`);
    } catch {
      setState({
        status: 'failed',
        title: 'We couldn’t confirm it was sent.',
        detail: 'Nothing you typed has been lost. Check your connection and send it again.',
      });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="ds-form-done" ref={doneRef} tabIndex={-1}>
        <p className="ds-form-done__body">
          <strong>{copy.doneTitle}</strong> {copy.doneBody}
        </p>
      </div>
    );
  }

  const error = (name: string) => fields.errors[name];
  const errorProps = (name: string) => (error(name) ? { error: error(name) } : {});
  const ids = {
    statement: `${id}-statement`,
    link: `${id}-link`,
    contact: `${id}-contact`,
    privacy: `${id}-privacy`,
  };

  return (
    <form
      className="ds-form"
      onSubmit={handleSubmit}
      onBlur={fields.onBlur}
      onChange={fields.onChange}
      ref={formRef}
      noValidate
    >
      <RequiredNote />
      <Field
        label={
          <>
            {copy.statementLabel}
            <RequiredMark />
          </>
        }
        htmlFor={ids.statement}
        hint={copy.statementHint}
        {...errorProps('statement')}
      >
        <textarea
          {...fieldControlProps({ htmlFor: ids.statement, hint: true, error: error('statement') })}
          name="statement"
          rows={4}
          required
          minLength={MIN_STATEMENT_LENGTH}
        />
      </Field>

      <Field
        label={
          <>
            {copy.linkLabel}
            {copy.linkRequired ? <RequiredMark /> : null}
          </>
        }
        htmlFor={ids.link}
        {...errorProps('sourceUrl')}
      >
        <input
          {...fieldControlProps({ htmlFor: ids.link, error: error('sourceUrl') })}
          name="sourceUrl"
          type="url"
          inputMode="url"
          required={copy.linkRequired}
          placeholder="https://"
        />
      </Field>

      {kind === 'appeal' ? (
        <Field
          label="Email"
          htmlFor={ids.contact}
          hint="Only used to send your receipt and the outcome."
          {...errorProps('contact')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.contact, hint: true, error: error('contact') })}
            name="contact"
            type="email"
            autoComplete="email"
          />
        </Field>
      ) : null}

      <div className="ds-form-check" data-invalid={error('privacyConsent') ? 'true' : undefined}>
        <input
          {...fieldControlProps({ htmlFor: ids.privacy, error: error('privacyConsent') })}
          name="privacyConsent"
          type="checkbox"
          required
        />
        <label htmlFor={ids.privacy}>
          I’ve read how this is handled.
          <RequiredMark />
          <small>{CORRECTION_PRIVACY_NOTICE.body}</small>
        </label>
        {error('privacyConsent') ? (
          <p className="ds-doc-field__error" id={fieldErrorId(ids.privacy)} role="alert">
            {error('privacyConsent')}
          </p>
        ) : null}
      </div>

      {state.status === 'failed' ? (
        <div ref={failureRef} tabIndex={-1}>
          <FormFailure title={state.title}>{state.detail}</FormFailure>
        </div>
      ) : null}

      <SubmitRow
        pending={state.status === 'submitting'}
        label={copy.send}
        pendingLabel="Sending"
        variant={copy.variant}
      />
    </form>
  );
}
