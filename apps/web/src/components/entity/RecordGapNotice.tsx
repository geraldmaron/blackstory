/**
 * Approved missing-information notice for sparse entity-page sections (acceptance
 * criterion 2). Renders through the shared `EmptyState` component so every gap reads
 * consistently; copy is centralized in `./copy.ts`, never hand-typed at the call site.
 */

import React from 'react';
import { EmptyState } from '@blap/ui';
import { RECORD_GAP_COPY, type RecordGapKind } from './copy';

export type RecordGapNoticeProps = {
  readonly kind: RecordGapKind;
};

export function RecordGapNotice({ kind }: RecordGapNoticeProps) {
  const copy = RECORD_GAP_COPY[kind];
  return <EmptyState title={copy.title}>{copy.body}</EmptyState>;
}
