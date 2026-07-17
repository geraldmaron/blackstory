/**
 * Public search domain surface (BB-049): pure, deterministic, auditable search index construction,
 * text-relevance ranking, faceting, filtering, per-result explanations, and the end-to-end
 * execution pipeline. Nothing here exposes a raw relevance score, evidence count, or other numeric
 * ranking signal to end users — connection strength is an internal ordering key only.
 */
export * from './types.js';
export * from './ranking.js';
export * from './facets.js';
export * from './explain.js';
export * from './index-build.js';
export * from './query.js';
export * from './rrf.js';
export * from './lanes.js';
export * from './fusion.js';
export * from './hybrid-explain.js';
export * from './hybrid.js';
