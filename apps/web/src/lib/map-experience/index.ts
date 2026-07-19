/**
 * Barrel export for the map-experience data layer.
 *
 * Intentionally omits `./build-explore-map-source` — that module imports `@repo/security`
 * redaction (constitution/`node:fs`). Re-exporting it here pulled Node builtins into the
 * client webpack graph whenever anything imported this barrel (e.g. entity page helpers).
 * Import `./build-explore-map-source` directly from server-only callers.
 */
export * from './entity-geo';
export * from './geo-precision';
export * from './filters';
export * from './url-state';
export * from './county-choropleth';
export * from './join-county-population';
export * from './load-county-population-index';
export * from './density';
export * from './join-state-polygons';
export * from './us-state-polygons';
export * from './build-history-edge-lines';
export * from './dignity-style';
export * from './kind-encoding';
export * from './snapshot-mode';
