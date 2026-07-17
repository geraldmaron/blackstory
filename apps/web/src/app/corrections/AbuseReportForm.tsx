'use client';

/**
 * abuse-report form for harassing or coordinated correction activity.
 */
import { useId, useState, type FormEvent } from 'react';
import { Button, Notice } from '@black-book/ui';
import { ABUSE_REPORT_NOTICE, CORRECTION_PRIVACY_NOTICE } from './copy';
import { getCorrectionAppCheckHeaders } from './app-check-client';

type AbuseState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldIssues?: readonly { field: string; message: string }[];
    };

export function AbuseReportForm({ receiptCode }: { readonly receiptCode?: string | undefined }) {
  const [state, setState] = useState<AbuseState>({ status: 'idle' });
  const receiptId = useId();
  const statementId = useId();
  const sourceUrlId = useId();
  const privacyId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      receiptCode: String(data.get('receiptCode') ?? '').trim() || undefined,
      statement: String(data.get('statement') ?? '').trim(),
      sourceUrl: String(data.get('sourceUrl') ?? '').trim() || undefined,
      privacyConsent: data.get('privacyConsent') === 'on',
    };

    setState({ status: 'submitting' });
    try {
      const appCheckHeaders = await getCorrectionAppCheckHeaders();
      const response = await fetch('/corrections/abuse/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status === 202) {
        setState({ status: 'success' });
        form.reset();
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

      setState({ status: 'error', message: 'Something went wrong submitting your report.' });
    } catch {
      setState({ status: 'error', message: 'Something went wrong submitting your report.' });
    }
  }

  if (state.status === 'success') {
    return (
      <Notice tone="warning" title="Report received">
        Thank you — abuse reports are reviewed separately and never expose other submitters.
      </Notice>
    );
  }

  return (
    <form className="bb-stack" onSubmit={handleSubmit} noValidate>
      <p className="bb-sans">{ABUSE_REPORT_NOTICE}</p>

      {state.status === 'error' ? (
        <Notice tone="error" title="Report failed">
          {state.message}
          {state.fieldIssues ? (
            <ul>
              {state.fieldIssues.map((issue) => (
                <li key={issue.field}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={receiptId}>
          Related receipt code (optional)
        </label>
        <input
          className="bb-filters__control"
          id={receiptId}
          name="receiptCode"
          type="text"
          defaultValue={receiptCode ?? ''}
        />
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={statementId}>
          What happened? <span aria-hidden="true">*</span>
        </label>
        <textarea className="bb-filters__control" id={statementId} name="statement" rows={4} required />
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={sourceUrlId}>
          Supporting link (optional)
        </label>
        <input className="bb-filters__control" id={sourceUrlId} name="sourceUrl" type="url" />
      </div>

      <Notice tone="warning" title={CORRECTION_PRIVACY_NOTICE.title}>
        {CORRECTION_PRIVACY_NOTICE.body}
      </Notice>

      <div className="bb-row" style={{ alignItems: 'flex-start' }}>
        <input id={privacyId} name="privacyConsent" type="checkbox" required />
        <label htmlFor={privacyId} className="bb-sans" style={{ marginLeft: 'var(--bb-space-2)' }}>
          I confirm the privacy notice. <span aria-hidden="true">*</span>
        </label>
      </div>

      <Button type="submit" disabled={state.status === 'submitting'}>
        {state.status === 'submitting' ? 'Submitting…' : 'Submit abuse report'}
      </Button>
    </form>
  );
}
