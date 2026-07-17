/**
 * Barrel for the BB-053 evidence, confidence, dispute, and revision interface. The parent entity
 * page mounts `EntityEvidencePanel`; the other exports are available for direct reuse/testing.
 */
export { EntityEvidencePanel, type EntityEvidencePanelProps } from './EntityEvidencePanel';
export { EvidenceCard, type EvidenceCardProps } from './EvidenceCard';
export { EvidenceMeasurementLegend } from './EvidenceMeasurementLegend';
export {
  EvidenceResearchCoverageSummary,
  type EvidenceResearchCoverageSummaryProps,
} from './EvidenceResearchCoverageSummary';
export { EVIDENCE_GAP_COPY, type EvidenceGapCopy, type EvidenceGapKind } from './copy';
