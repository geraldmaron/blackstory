/**
 * Methodology-page definitions for BB-088 — reuses BB-090 notability rubric and BB-086 fact status
 * lifecycle vocabulary as the single source of truth for the public definitions section.
 */
import { FACT_STATUSES, type FactStatus } from '../facts/status.js';
import {
  LAW_STATUSES,
  MOVEMENT_STATUSES,
  PLACE_LIKE_STATUSES,
  type EntityStatusValue,
} from '../entity-status.js';

/** Workflow-rank definitions for canonical fact records (BB-086). */
export const FACT_STATUS_LIFECYCLE_DEFINITIONS: Readonly<Record<FactStatus, string>> = {
  draft:
    'Pre-publication work in progress. Draft facts never appear in the public projection or search index.',
  under_review:
    'Editorial review in progress. Under-review facts remain off public surfaces until citations and provenance clear the publish gate.',
  published:
    'Released to the public projection with complete citations and a mandatory revision log entry.',
  corrected:
    'Published fact with a logged correction. The original error remains visible in revision history; nothing is silently rewritten.',
  superseded:
    'Replaced by a newer fact record. The permalink stays live with a banner pointing to the successor.',
  deprecated:
    'Withdrawn from active use while remaining resolvable. A plain-language reason is always shown.',
};

/** Entity-level status vocabulary summaries for place-like, law, and movement kinds (BB-090). */
export const ENTITY_STATUS_VOCABULARY: Readonly<
  Record<'place_like' | 'law' | 'movement', readonly { readonly value: EntityStatusValue; readonly definition: string }[]>
> = {
  place_like: PLACE_LIKE_STATUSES.map((status) => ({
    value: status,
    definition:
      status === 'active'
        ? 'The entity still operates or serves its documented function.'
        : status === 'historic'
          ? 'The entity no longer operates in its original form but the documented site or institution remains historically significant.'
          : 'The entity is documented as closed, demolished, or otherwise inactive.',
  })),
  law: LAW_STATUSES.map((status) => ({
    value: status,
    definition:
      status === 'in_force'
        ? 'The law or ordinance is currently in effect.'
        : status === 'amended'
          ? 'The law remains in force but has been substantively amended.'
          : status === 'repealed'
            ? 'The law has been repealed and is no longer in effect.'
            : status === 'struck_down'
              ? 'A court has struck down the law; enforcement status follows the cited ruling.'
              : 'A court has enjoined enforcement pending further proceedings.',
  })),
  movement: MOVEMENT_STATUSES.map((status) => ({
    value: status,
    definition:
      status === 'active'
        ? 'The movement is documented as ongoing or recently active.'
        : 'The movement is documented as concluded or historically bounded.',
  })),
};

/** Source hierarchy tiers referenced on the methodology page. */
export const SOURCE_HIERARCHY_LEVELS = [
  {
    tier: 'primary',
    definition:
      'Contemporaneous documents, official records, court filings, archival manuscripts, and firsthand accounts created at or near the time of the event.',
  },
  {
    tier: 'secondary',
    definition:
      'Scholarly works, investigative journalism, and retrospective accounts that analyze primary sources. Secondary sources never outrank primary evidence on disputed facts.',
  },
  {
    tier: 'tertiary',
    definition:
      'Compendia, encyclopedias, and aggregated databases useful for discovery but requiring verification against primary or secondary sources before publication.',
  },
] as const;

/** Fail-closed: every declared fact status has methodology copy. */
export function assertFactStatusDefinitionsComplete(): void {
  for (const status of FACT_STATUSES) {
    if (!FACT_STATUS_LIFECYCLE_DEFINITIONS[status]?.trim()) {
      throw new Error(`Missing methodology definition for fact status "${status}"`);
    }
  }
}
