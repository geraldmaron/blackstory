/**
 * Operator MCP indicator tool request/response shapes (Phase 1 contract).
 */

export type SeriesSummary = {
  readonly metricId: string;
  readonly metricDefinition: string;
  readonly universe: string;
  readonly unit: string;
  readonly sourceDataset: string;
  readonly sourceTable: string;
  readonly sourceVariable: string;
  readonly geographyType: string;
  readonly estimateType: string;
  readonly periodType: string;
  readonly externalDataSourceId: string | null;
  readonly theme?: string;
};

export type ObservationProvenance = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

export type ObservationPayload = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError: number | null;
  readonly status: 'observed';
  readonly provenance: ObservationProvenance;
};

export type EntityContextBinding = {
  readonly metricId: string;
  readonly purpose: string;
  readonly jurisdictionId: string | null;
  readonly notes: string;
  readonly observation: ObservationPayload | null;
};

export type LookupSeriesInput = {
  readonly metricId?: string;
  readonly theme?: string;
  readonly geographyType?: string;
};

export type GetObservationsInput = {
  readonly metricId: string;
  readonly jurisdictionId?: string;
  readonly referencePeriod?: string;
  readonly limit?: number;
};

export type GetEntityContextInput = {
  readonly entityId: string;
  readonly purpose?: string;
  readonly referencePeriod?: string;
};

export type GetLawTimelineInput = {
  readonly entityId?: string;
  readonly topicId?: string;
  readonly stateFips?: string;
};
