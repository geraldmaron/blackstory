/**
 * Approved copy for the BB-053 evidence panel's empty/gap states, kept local to this component
 * tree (a small, deliberate duplication of the pattern in `components/entity/copy.ts`, which is
 * owned by a different bead's exclusive-path scope) so every gap in this panel reads consistently
 * without cross-agent file coupling.
 */

export type EvidenceGapKind = 'claims' | 'revisionHistory';

export type EvidenceGapCopy = {
  readonly title: string;
  readonly body: string;
};

export const EVIDENCE_GAP_COPY: Readonly<Record<EvidenceGapKind, EvidenceGapCopy>> = {
  claims: {
    title: 'No accepted claims yet',
    body:
      'No claims have cleared the evidence bar for this record yet. This reflects the current ' +
      'state of research, not an absence of history \u2014 coverage deepens as research continues.',
  },
  revisionHistory: {
    title: 'No revision history recorded',
    body: 'No claim-level revision events have been recorded for this record yet.',
  },
};
