/**
 * The static snapshot behind /lives/[area]: one built bundle per area, rebuilt when figures, notes or
 * rules change, and read by web and mobile without querying the reference tables at request time.
 * Method: docs/methodology/lives-across-decades.md.
 */
import { LIVES_DECADES } from './lives-regimes.js';
import type { LivesAreaBundle } from './lives-timeline.js';

export const LIVES_SNAPSHOT_VERSION = 1;

/** Kind and name of a rule's catalog record, so a surface can link to its law or case page. */
export type LivesRuleEntityRef = {
  readonly kind: string;
  readonly displayName: string;
};

export type LivesAreaSnapshot = {
  readonly version: typeof LIVES_SNAPSHOT_VERSION;
  readonly areaSlug: string;
  readonly generatedAt: string;
  /** Hash of the bundle and rule entities; unchanged content is not rewritten. */
  readonly contentHash: string;
  readonly bundle: LivesAreaBundle;
  readonly ruleEntities: Readonly<Record<string, LivesRuleEntityRef>>;
};

export function livesSnapshotName(areaSlug: string): string {
  return `livesArea:${areaSlug}`;
}

export function isLivesAreaSnapshot(value: unknown): value is LivesAreaSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LivesAreaSnapshot>;
  return (
    candidate.version === LIVES_SNAPSHOT_VERSION &&
    typeof candidate.areaSlug === 'string' &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.contentHash === 'string' &&
    !!candidate.ruleEntities &&
    typeof candidate.ruleEntities === 'object' &&
    !!candidate.bundle &&
    candidate.bundle.areaSlug === candidate.areaSlug &&
    Array.isArray(candidate.bundle.decades) &&
    candidate.bundle.decades.length === LIVES_DECADES.length
  );
}
