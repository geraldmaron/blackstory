/**
 * Evidence, confidence, dispute, and revision interface. The top-level export the parent
 * entity page (`apps/web/src/app/entity/[id]/page.tsx`) mounts inside its own
 * `<section aria-labelledby="...">`, matching the existing pattern of `EntityStatusPanel` /
 * `EntityRelatedList` (a `labelledBy` prop into shared markup, no self-owned `<h2>`).
 *
 * Renders, per claim, an evidence-score confidence card (never probability language unless
 * calibrated) with a claim↔citation aria association; a shared measurement legend distinguishing
 * confidence, relevance, connection strength, and research coverage; preserved
 * contradiction/dispute notices rather than a silently resolved single answer; and rights-limited
 * excerpts plus citation links that withhold protected/private evidence rather than leaking it.
 * Also surfaces a record-level research-coverage / source-lineage / last-checked summary and any
 * record-level retraction or correction notices.
 *
 * Every prop accepts the seed-depth shape already available on `PublicEntityView`/`PublicClaimView`
 * (`apps/web/src/data/public-seed.ts`) with light field renaming (see `../../lib/evidence/types.ts`'s
 * module doc), so the parent can mount this against today's seed fixtures, and the same props
 * accept richer projection data once it exists without a shape change.
 */

import React from 'react';
import { EmptyState } from '@repo/ui';
import { buildEvidenceCards, mostRecentLastCheckedAt, totalSourceLineageCount } from '../../lib/evidence';
import type {
  EvidenceClaimInput,
  EvidenceResearchCoverageInput,
  EvidenceRetractionNotice,
  EvidenceSourceLineageInput,
} from '../../lib/evidence';
import { EVIDENCE_GAP_COPY } from './copy';
import { EvidenceCard } from './EvidenceCard';
import { EvidenceMeasurementLegend } from './EvidenceMeasurementLegend';
import { EvidenceResearchCoverageSummary } from './EvidenceResearchCoverageSummary';

export type EntityEvidencePanelProps = {
  /** Id of the caller's own heading (e.g. `"evidence-heading"`) — this panel's landmark should be
   * associated with this component never renders its own `<h2>`. */
  readonly labelledBy: string;
  readonly claims: readonly EvidenceClaimInput[];
  /** Record-level research-coverage measurement (e.g. `entity.researchCoverage`, wrapped as
   * `{ level: entity.researchCoverage }`). Kept required since every record carries one today. */
  readonly researchCoverage: EvidenceResearchCoverageInput;
  /** Record-level independent-source-lineage rollup. Falls back to the sum of each claim's own
   * `sourceLineage.independentLineageCount` when omitted. */
  readonly sourceLineage?: EvidenceSourceLineageInput;
  /** Record-level last-checked date. Falls back to the most recent date across claims when
   * omitted. */
  readonly lastCheckedAt?: string;
  /** Retraction/correction notices that apply to the record rather than a single claim.  */
  readonly retractionNotices?: readonly EvidenceRetractionNotice[];
};

export function EntityEvidencePanel({
  labelledBy,
  claims,
  researchCoverage,
  sourceLineage,
  lastCheckedAt,
  retractionNotices,
}: EntityEvidencePanelProps) {
  const cards = buildEvidenceCards(claims);
  const resolvedSourceLineage = sourceLineage ?? {
    independentLineageCount: totalSourceLineageCount(cards),
  };
  const resolvedLastCheckedAt = lastCheckedAt ?? mostRecentLastCheckedAt(cards);

  return (
    <div className="ds-stack" aria-labelledby={labelledBy}>
      <EvidenceMeasurementLegend />

      <EvidenceResearchCoverageSummary
        researchCoverage={researchCoverage}
        sourceLineage={resolvedSourceLineage}
        {...(resolvedLastCheckedAt ? { lastCheckedAt: resolvedLastCheckedAt } : {})}
        {...(retractionNotices ? { retractionNotices } : {})}
      />

      {cards.length === 0 ? (
        <EmptyState title={EVIDENCE_GAP_COPY.claims.title}>{EVIDENCE_GAP_COPY.claims.body}</EmptyState>
      ) : (
        <div className="ds-stack">
          {cards.map((card) => (
            <EvidenceCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
