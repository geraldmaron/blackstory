/**
 * Provenance stamping for every external web-search query and the results it produces (
 * ): API name, query text, timestamp, and plan/terms version.
 */
import type { ExternalQueryProvenance, WebSearchProvider } from './types.js';

function apiNameFor(provider: WebSearchProvider): string {
  return provider === 'brave' ? 'Brave Search API' : 'Exa Search API';
}

export function stampExternalQueryProvenance(input: {
  readonly provider: WebSearchProvider;
  readonly queryText: string;
  readonly executedAt: string;
  readonly planTermsVersion: string;
}): ExternalQueryProvenance {
  if (!input.queryText.trim()) {
    throw new Error('External query provenance requires a non-empty queryText');
  }
  if (!input.executedAt.trim()) {
    throw new Error('External query provenance requires executedAt');
  }
  if (!input.planTermsVersion.trim()) {
    throw new Error('External query provenance requires a planTermsVersion');
  }
  return {
    apiName: apiNameFor(input.provider),
    queryText: input.queryText.trim(),
    executedAt: input.executedAt,
    planTermsVersion: input.planTermsVersion.trim(),
  };
}
