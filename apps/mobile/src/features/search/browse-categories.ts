/**
 * Static category list for browse mode (MOB-013 item 2). Sourced from the SAME closed
 * `ENTITY_KINDS` allow-list `apps/mobile/src/lib/route-params.ts` already validates route
 * params against -- not a separately-invented vocabulary -- so a category chip always navigates
 * to a `kind` value Explore's own filter parsing already accepts.
 *
 * `LABELS` is an exhaustive `Record<EntityKind, string>` on purpose: because the kind list is now
 * imported from the contract rather than copied, adding a kind upstream fails the typecheck here
 * until someone writes its label, instead of silently dropping a category from the browse screen.
 */
import { ENTITY_KINDS, type EntityKind } from '@/lib/route-params';

export interface BrowseCategory {
  readonly kind: EntityKind;
  readonly label: string;
}

const LABELS: Record<EntityKind, string> = {
  person: 'People',
  place: 'Places',
  school: 'Schools',
  organization: 'Organizations',
  institution: 'Institutions',
  event: 'Events',
  law: 'Laws',
  case: 'Cases',
  publication: 'Publications',
  artifact: 'Artifacts',
  movement: 'Movements',
  invention: 'Inventions',
  other: 'Other',
};

export const BROWSE_CATEGORIES: readonly BrowseCategory[] = ENTITY_KINDS.map((kind) => ({
  kind,
  label: LABELS[kind],
}));
