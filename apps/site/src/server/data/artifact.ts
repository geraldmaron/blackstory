/** The one import of @repo/domain, isolated so modules that do not need the artifact fetcher load without it. */
// eslint-disable-next-line import/no-unresolved -- resolved by Metro (extraNodeModules in metro.config.js)
export { fetchReleaseSearchIndexArtifact } from '@repo/domain';
