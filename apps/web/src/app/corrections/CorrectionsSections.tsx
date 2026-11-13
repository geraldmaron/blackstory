/**
 * The correction room's body: the form, and beside it what happens next. What used to be a
 * three-step strip above the form, a privacy drawer below it and a receipt link under that is
 * now the one aside every public form has.
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { FormLayout, NextSteps } from '../../components/forms/FormKit';
import { CorrectionForm, type CorrectionFormProps } from './CorrectionForm';

void React;

export function CorrectionsSections(props: CorrectionFormProps) {
  return (
    <FormLayout
      aside={
        <NextSteps
          steps={[
            'A person reads it against the published sources, usually within ten working days.',
            'If it holds up, the record changes and the change is listed in Errata, with the earlier wording still readable.',
            'If it is declined, you get the reason, and one appeal.',
          ]}
        >
          <p>
            Save your receipt code. It is the only way to look up the outcome, and coordinated
            volume never changes a grade or what publishes.
          </p>
          <p>
            Already have a code? <Link href="/corrections/status">Check a receipt</Link>.
          </p>
        </NextSteps>
      }
    >
      <Suspense fallback={<p className="ds-form-note">Loading the correction form…</p>}>
        <CorrectionForm {...props} />
      </Suspense>
    </FormLayout>
  );
}
