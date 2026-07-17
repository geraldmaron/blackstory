/**
 * Standing not-legal-advice disclaimer for every BB-087 legal explainer surface (AC6).
 */
import React from 'react';
import { Notice } from '@black-book/ui';
import { LEGAL_DISCLAIMER_BODY, LEGAL_DISCLAIMER_TITLE } from './copy';

export function LegalDisclaimer() {
  return (
    <Notice tone="warning" title={LEGAL_DISCLAIMER_TITLE}>
      <p style={{ margin: 0 }}>{LEGAL_DISCLAIMER_BODY}</p>
    </Notice>
  );
}
