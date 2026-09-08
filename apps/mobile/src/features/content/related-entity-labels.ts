/**
 * Human labels for related-entity ids cited from bundled Learn content.
 * Presentation only — navigation still uses the canonical entity id.
 * Never show raw `ent_*` strings in user-visible chrome.
 */
export type RelatedEntityLabel = {
  readonly displayName: string;
  readonly kind: string;
  readonly place?: string;
};

export const RELATED_ENTITY_LABELS: Readonly<Record<string, RelatedEntityLabel>> = {
  ent_dunbar_school_001: {
    displayName: 'Paul Laurence Dunbar High School',
    kind: 'School',
    place: 'Washington, D.C.',
  },
  ent_15th_st_church_001: {
    displayName: 'Fifteenth Street Presbyterian Church',
    kind: 'Place',
    place: 'Washington, D.C.',
  },
  ent_dc_landmark_listing_1975: {
    displayName: 'D.C. Inventory of Historic Sites listing',
    kind: 'Event',
    place: 'Washington, D.C.',
  },
};

/** Resolves a related-entity id to a display card; never returns the raw id as the title. */
export function resolveRelatedEntityLabel(entityId: string): RelatedEntityLabel {
  const known = RELATED_ENTITY_LABELS[entityId];
  if (known) return known;
  return {
    displayName: 'Archive record',
    kind: 'Record',
  };
}

/** Subtitle line: `School · Washington, D.C.` (omits empty segments). */
export function relatedEntitySubtitle(label: RelatedEntityLabel): string {
  return [label.kind, label.place].filter(Boolean).join(' · ');
}
