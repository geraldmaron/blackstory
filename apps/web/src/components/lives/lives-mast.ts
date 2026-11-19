/**
 * The display numeral both Lives pages open on: how many census decades the area's bundle holds,
 * with the first and last named beside it. Absent when nothing loaded, so an outage never prints 0.
 */
import type { LivesAreaBundle } from '@repo/domain/statistics/lives';
import type { TrustMastNumeral } from '../trust';

export function livesDecadeNumeral(bundle: LivesAreaBundle): TrustMastNumeral | undefined {
  const first = bundle.decades[0];
  const last = bundle.decades.at(-1);
  if (first === undefined || last === undefined) return undefined;
  return {
    value: String(bundle.decades.length),
    label: `decades on record, ${first.label} to ${last.label}`,
  };
}
