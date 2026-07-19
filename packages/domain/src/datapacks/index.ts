/**
 * Data Pack v1 contract barrel (the related workstream). See `./manifest.ts`'s header for the full
 * design rationale — this is the contract + local validation pipeline for third-party datasets,
 * not the ops/ingestion infrastructure.
 */
export * from './manifest.js';
export * from './records.js';
export * from './validate.js';
export * from './import-pipeline.js';
