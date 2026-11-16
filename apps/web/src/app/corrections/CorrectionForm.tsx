'use client';

/**
 * Public correction intake form. Posts to `/corrections/api`, quarantine-only, never public.
 * Supports entity/claim/source/location targets, structured categories, a source URL and
 * privacy consent, and returns a receipt code on success.
 *
 * Checked as the reader goes (`correction-form.ts`); the server still decides. On success the
 * form is replaced by the receipt; on failure everything typed stays in place.
 */
import React, { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { buttonClassName, Segmented } from '@repo/ui';
import { ChoiceField, Field, fieldControlProps, fieldErrorId } from '../../components/room';
import { FormFailure, RequiredMark, RequiredNote, SubmitRow } from '../../components/forms/FormKit';
import { useFieldErrors } from '../../components/forms/use-field-errors';
import { ReceiptBlock } from './ReceiptBlock';
import {
  CORRECTION_CATEGORIES,
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_SHORT_LABELS,
  CORRECTION_TARGET_TYPES,
  type CorrectionTargetType,
} from './categories';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import { validateCorrectionForm } from './correction-form';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';

void React;

const FORM_FIELDS = new Set([
  'targetType',
  'targetRecordId',
  'category',
  'statement',
  'sourceUrl',
  'contact',
  'privacyConsent',
]);

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly receiptCode: string; readonly statusHref: string }
  | { readonly status: 'failed'; readonly title: string; readonly detail: string };

export type CorrectionFormProps = {
  readonly initialTarget?: string;
  readonly initialTargetType?: CorrectionTargetType;
  readonly targetName?: string;
};

export function CorrectionForm({
  initialTarget = '',
  initialTargetType = 'entity',
  targetName,
}: CorrectionFormProps) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const fields = useFieldErrors(validateCorrectionForm);
  const formRef = useRef<HTMLFormElement | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const failureRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const ids = {
    target: `${id}-target`,
    statement: `${id}-statement`,
    source: `${id}-source`,
    contact: `${id}-contact`,
    privacy: `${id}-privacy`,
  };

  /*
   * The receipt code is the only credential for looking up what happened to a report, and the
   * receipt replaces the whole form, so focus moves to it; a failure moves focus to its message.
   */
  useEffect(() => {
    if (state.status === 'success') receiptRef.current?.focus();
    if (state.status === 'failed') failureRef.current?.focus();
  }, [state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!fields.validateAll(form)) return;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const payload = {
      targetType: text('targetType') || 'entity',
      targetRecordId: text('targetRecordId'),
      category: text('category'),
      statement: text('statement'),
      sourceUrl: text('sourceUrl') || undefined,
      privacyConsent: data.get('privacyConsent') === 'on',
      contact: text('contact') || undefined,
    };

    setState({ status: 'submitting' });
    try {
      const integrityHeaders = await getRequestIntegrityHeaders();
      const response = await fetch('/corrections/api', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...integrityHeaders },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status === 202 && body && typeof body === 'object' && 'receiptCode' in body) {
        const receiptCode = String((body as { receiptCode: unknown }).receiptCode);
        const statusHref =
          'statusHref' in body
            ? String((body as { statusHref: unknown }).statusHref)
            : `/corrections/status/${encodeURIComponent(receiptCode)}`;
        setState({ status: 'success', receiptCode, statusHref });
        return;
      }
      if (response.status === 429) {
        setState({
          status: 'failed',
          title: 'Too many corrections from this connection just now.',
          detail: 'Wait a few minutes, then send it again. Nothing you typed has been lost.',
        });
        return;
      }
      if (response.status === 400 && body && typeof body === 'object' && 'issues' in body) {
        const issues =
          (body as { issues?: readonly { field: string; message: string }[] }).issues ?? [];
        const elsewhere = issues.filter((issue) => !FORM_FIELDS.has(issue.field));
        fields.showIssues(
          formRef.current,
          issues.filter((issue) => FORM_FIELDS.has(issue.field)),
        );
        setState(
          elsewhere.length === 0
            ? { status: 'idle' }
            : {
                status: 'failed',
                title: 'The correction was not accepted.',
                detail: elsewhere.map((issue) => issue.message).join(' '),
              },
        );
        return;
      }
      throw new Error(`correction intake answered ${response.status}`);
    } catch {
      setState({
        status: 'failed',
        title: 'The correction was not sent.',
        detail: 'Nothing you typed has been lost. Check your connection and send it again.',
      });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="ds-form-done" ref={receiptRef} tabIndex={-1}>
        <h2 className="ds-form-done__title">It arrived. Here is your receipt.</h2>
        <p className="ds-form-done__body">
          Nothing you sent is public. A person reads it against the published sources, and if it is
          declined you get the reason.
        </p>
        <ReceiptBlock receiptCode={state.receiptCode} />
        <div className="ds-form-done__actions">
          <a className={buttonClassName('secondary')} href={state.statusHref}>
            Check this receipt
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
        <legend>The record</legend>

        <div className="ds-room-field">
          <span className="ds-room-field__label" aria-hidden="true">
            What are you correcting?
          </span>
          <Segmented
            label="What are you correcting?"
            name="targetType"
            value={initialTargetType}
            options={CORRECTION_TARGET_TYPES.map((targetType) => ({
              value: targetType,
              label: CORRECTION_TARGET_SHORT_LABELS[targetType],
            }))}
          />
        </div>

        {targetName && initialTargetType === 'entity' ? (
          <p className="ds-form-group__hint">
            Opened from <a href={`/entity/${encodeURIComponent(initialTarget)}`}>{targetName}</a>.
            The record reference is filled in below; you can change it.
          </p>
        ) : null}

        <Field
          label={
            <>
              Which record is wrong?
              <RequiredMark />
            </>
          }
          htmlFor={ids.target}
          hint="Name the place or paste its page address. You do not need an internal id."
          {...errorProps('targetRecordId')}
        >
          <input
            {...fieldControlProps({
              htmlFor: ids.target,
              hint: true,
              error: error('targetRecordId'),
            })}
            name="targetRecordId"
            type="text"
            defaultValue={initialTarget}
            maxLength={128}
            required
          />
        </Field>

        <ChoiceField
          className="ds-form-cards"
          legend={
            <>
              What is wrong with it?
              <RequiredMark />
            </>
          }
          name="category"
          id={`${id}-category`}
          required
          choices={CORRECTION_CATEGORIES.map((category) => ({
            value: category,
            label: CORRECTION_CATEGORY_LABELS[category],
          }))}
          {...errorProps('category')}
        />
      </fieldset>

      <fieldset className="ds-form-group">
        <legend>The fix</legend>
        <Field
          label={
            <>
              What should it say instead?
              <RequiredMark />
            </>
          }
          htmlFor={ids.statement}
          hint="For example: The 1891 building was purpose-built, not converted. Plain language is fine."
          {...errorProps('statement')}
        >
          <textarea
            {...fieldControlProps({
              htmlFor: ids.statement,
              hint: true,
              error: error('statement'),
            })}
            name="statement"
            rows={5}
            required
            minLength={20}
          />
        </Field>

        {/*
          Required, and marked so: `correction-intake.ts` rejects a submission with no source URL,
          and the link is what makes a correction reviewable rather than an assertion.
        */}
        <Field
          label={
            <>
              Where can it be checked?
              <RequiredMark />
            </>
          }
          htmlFor={ids.source}
          hint="A link to the source that shows the right version."
          {...errorProps('sourceUrl')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.source, hint: true, error: error('sourceUrl') })}
            name="sourceUrl"
            type="url"
            inputMode="url"
            required
            placeholder="https://"
          />
        </Field>
      </fieldset>

      <fieldset className="ds-form-group">
        <legend>About you</legend>
        <Field
          label="Email"
          htmlFor={ids.contact}
          hint="Only used to send you the outcome."
          {...errorProps('contact')}
        >
          <input
            {...fieldControlProps({ htmlFor: ids.contact, hint: true, error: error('contact') })}
            name="contact"
            type="email"
            autoComplete="email"
            placeholder="you@example.org"
          />
        </Field>

        <div className="ds-form-check" data-invalid={error('privacyConsent') ? 'true' : undefined}>
          <input
            {...fieldControlProps({ htmlFor: ids.privacy, error: error('privacyConsent') })}
            name="privacyConsent"
            type="checkbox"
            required
          />
          <label htmlFor={ids.privacy}>
            I have read how a correction is handled, and understand it enters a restricted review
            queue.
            <RequiredMark />
            <small>{CORRECTION_PRIVACY_NOTICE.body}</small>
          </label>
          {error('privacyConsent') ? (
            <p className="ds-room-field__error" id={fieldErrorId(ids.privacy)} role="alert">
              {error('privacyConsent')}
            </p>
          ) : null}
        </div>
      </fieldset>

      {state.status === 'failed' ? (
        <div ref={failureRef} tabIndex={-1}>
          <FormFailure title={state.title}>{state.detail}</FormFailure>
        </div>
      ) : null}

      <SubmitRow
        pending={state.status === 'submitting'}
        label="Send the correction"
        pendingLabel="Sending"
        note="You get a receipt code on the next screen."
      />
    </form>
  );
}
