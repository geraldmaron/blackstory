/**
 * Typed graph edges for national-story seed entities — merged into entity-graph-seed.ts.
 */
import type { EntityRelationship } from '@black-book/domain';

export const NATIONAL_STORY_RELATIONSHIPS: readonly EntityRelationship[] = [
  {
    id: 'rel_emancipation_oak_located_at_hampton',
    fromEntityId: 'ent_emancipation_oak_001',
    toEntityId: 'ent_hampton_university_001',
    type: 'located_at',
    evidenceIds: ['evid_emancipation_oak_campus'],
    temporal: { validFrom: '1861' },
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
  },
  {
    id: 'rel_emancipation_oak_part_of_hampton',
    fromEntityId: 'ent_emancipation_oak_001',
    toEntityId: 'ent_hampton_university_001',
    type: 'part_of',
    evidenceIds: ['evid_emancipation_oak_campus'],
    temporal: { validFrom: '1868' },
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
  },
];
