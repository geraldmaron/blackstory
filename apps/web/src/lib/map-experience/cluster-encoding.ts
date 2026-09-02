/**
 * Cluster paint expressions: dominant kind-family shade with neutral fallback for ties
 * or missing family data. Count labels remain the non-color signal (WCAG 1.4.1).
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { DEFAULT_KIND_ENCODING, KIND_FAMILY_ENTRIES } from './kind-encoding';

/**
 * Mixed-kind clusters pick the family with the highest leaf count; ties break in
 * fixed priority (events → sources → organizations → places → people). When every
 * counter is zero, fall back to the neutral "other" family shade.
 */
export function clusterDominantFamilyShadeExpression(): ExpressionSpecification {
  let expr: ExpressionSpecification =
    DEFAULT_KIND_ENCODING.shade as unknown as ExpressionSpecification;
  for (const [family, entry] of [...KIND_FAMILY_ENTRIES].reverse()) {
    const countKey = `${family}_n`;
    const rivals = KIND_FAMILY_ENTRIES.filter(([candidate]) => candidate !== family).map(
      ([candidate]) => ['get', `${candidate}_n`],
    );
    const rivalMax =
      rivals.length > 0
        ? (['max', ...rivals] as unknown as ExpressionSpecification)
        : (0 as unknown as ExpressionSpecification);
    expr = [
      'case',
      ['all', ['>', ['get', countKey], 0], ['>=', ['get', countKey], rivalMax]],
      entry.shade,
      expr,
    ] as unknown as ExpressionSpecification;
  }
  return expr;
}
